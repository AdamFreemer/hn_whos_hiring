// app/api/cron/ingest/route.ts
// Triggered by Vercel Cron (see vercel.json). Self-gates: each run discovers
// new threads, then scrapes only the threads the DB says are "due" per the
// decaying schedule in threads_due_for_scrape(). Writes go through the
// service-role key (server-only, never shipped to the browser).
//
// Manual one-time backfill of history:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "https://<your-app>/api/cron/ingest?mode=backfill&limit=50"
// Call it a few times until it reports 0 scraped.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  TECHS, techsInPost, stripHtml, firstLine, parseRemote, parseSalary,
} from "@/lib/techs";

export const runtime = "nodejs";
export const maxDuration = 300;      // Pro plan ceiling; we finish well under this
export const dynamic = "force-dynamic";

const ALGOLIA = "https://hn.algolia.com/api/v1/search";
const ARCHIVE_AFTER_DAYS = 35;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function admin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// fetch with exponential backoff on 429 / 5xx (the only real rate-limit guard
// we need — steady-state volume is a handful of requests per run)
async function getJSON(url: string, tries = 4): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (r.status === 429 || r.status >= 500) { await sleep(400 * 2 ** i); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return r.json();
  }
  throw new Error(`gave up after ${tries} tries: ${url}`);
}

async function fetchAll(tags: string): Promise<any[]> {
  const first = await getJSON(`${ALGOLIA}?tags=${tags}&hitsPerPage=1000&page=0`);
  let hits: any[] = first.hits || [];
  const pages = Math.min(first.nbPages || 1, 6);
  for (let p = 1; p < pages; p++) {
    const d = await getJSON(`${ALGOLIA}?tags=${tags}&hitsPerPage=1000&page=${p}`);
    hits = hits.concat(d.hits || []);
    await sleep(120); // be polite between pages
  }
  return hits;
}

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

// 1) discover every "Who is hiring?" thread and upsert thread rows
async function discover(db: ReturnType<typeof admin>) {
  const hits = await fetchAll("author_whoishiring,story");
  const rows = hits
    .filter(h => h.title && /who is hiring/i.test(h.title))
    .map(h => ({
      id: Number(h.objectID),
      month: monthKey(h.created_at),
      title: h.title as string,
      posted_at: h.created_at as string,
      hn_points: h.points || 0,
      num_comments: h.num_comments || 0,
    }));
  // upsert without clobbering scrape bookkeeping (only these columns)
  if (rows.length) {
    await db.from("threads").upsert(rows, { onConflict: "id", ignoreDuplicates: false });
  }
  return rows.length;
}

// 2) scrape one thread: comments -> posts -> post_techs -> counts -> bookkeeping
async function scrapeThread(db: ReturnType<typeof admin>, thread: any) {
  const id = Number(thread.id);
  const hits = await fetchAll(`comment,story_${id}`);
  const now = new Date().toISOString();

  const top = hits.filter(h => String(h.parent_id) === String(id) && h.comment_text);
  const postRows: any[] = [];
  const techRows: { post_id: number; tech_slug: string }[] = [];
  const counts: Record<string, number> = {};

  for (const c of top) {
    const body = stripHtml(c.comment_text);
    if (!body) continue;
    const lower = body.toLowerCase();
    const pid = Number(c.objectID);
    const sal = parseSalary(body);
    postRows.push({
      id: pid,
      thread_id: id,
      author: c.author || null,
      title: firstLine(body),
      body,
      posted_at: c.created_at || null,
      is_remote: parseRemote(lower),
      salary_min: sal.min,
      salary_max: sal.max,
      salary_currency: sal.currency,
      updated_at: now,
    });
    for (const slug of techsInPost(body)) {
      techRows.push({ post_id: pid, tech_slug: slug });
      counts[slug] = (counts[slug] || 0) + 1;
    }
  }

  // upsert posts
  for (let i = 0; i < postRows.length; i += 500) {
    await db.from("posts").upsert(postRows.slice(i, i + 500), { onConflict: "id" });
  }
  // refresh post_techs for this thread's posts (handles edited posts cleanly)
  const postIds = postRows.map(p => p.id);
  if (postIds.length) {
    for (let i = 0; i < postIds.length; i += 1000) {
      await db.from("post_techs").delete().in("post_id", postIds.slice(i, i + 1000));
    }
    for (let i = 0; i < techRows.length; i += 1000) {
      await db.from("post_techs").insert(techRows.slice(i, i + 1000));
    }
  }
  // rebuild pre-aggregated counts for this thread
  const total = postRows.length;
  await db.from("thread_tech_counts").delete().eq("thread_id", id);
  const ttc = Object.entries(counts).map(([tech_slug, n]) => ({
    thread_id: id, tech_slug, post_count: n,
    pct: total ? Math.round((n / total) * 10000) / 100 : 0,
  }));
  if (ttc.length) await db.from("thread_tech_counts").insert(ttc);

  // bookkeeping
  const ageDays = (Date.now() - new Date(thread.posted_at).getTime()) / 86400000;
  await db.from("threads").update({
    post_count: total,
    last_scraped_at: now,
    first_scraped_at: thread.first_scraped_at ?? now,
    scrape_count: (thread.scrape_count ?? 0) + 1,
    is_archived: ageDays >= ARCHIVE_AFTER_DAYS,
  }).eq("id", id);

  return total;
}

export async function GET(req: Request) {
  // auth: Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "tick";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 8), 60);

  const db = admin();
  const discovered = await discover(db);

  // pick what to scrape
  let due: any[] = [];
  if (mode === "backfill") {
    const { data } = await db
      .from("threads").select("*")
      .eq("scrape_count", 0).eq("is_archived", false)
      .order("posted_at", { ascending: true }).limit(limit);
    due = data ?? [];
  } else {
    const { data } = await db.rpc("threads_due_for_scrape");
    due = (data ?? []).slice(0, limit);
  }

  const results: { id: number; month: string; posts: number }[] = [];
  for (const t of due) {
    try {
      const posts = await scrapeThread(db, t);
      results.push({ id: Number(t.id), month: t.month, posts });
    } catch (e: any) {
      results.push({ id: Number(t.id), month: t.month, posts: -1 });
      console.error(`scrape failed for ${t.id}:`, e?.message);
    }
    await sleep(150); // gap between threads
  }

  return NextResponse.json({
    ok: true, mode, discovered, scraped: results.length, results,
  });
}
