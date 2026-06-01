// lib/queries.ts
// Browser-side reads. These hit only the small pre-aggregated tables, so the
// UI never scrapes Algolia and never scans post bodies for the charts.

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Stat row: total threads + first/most-recent month.
export async function getOverview() {
  const { count } = await supabase
    .from("threads").select("*", { count: "exact", head: true });
  const { data: first } = await supabase
    .from("threads").select("month").order("month", { ascending: true }).limit(1).single();
  const { data: last } = await supabase
    .from("threads").select("month, post_count, hn_points")
    .order("month", { ascending: false }).limit(1).single();
  return { total: count ?? 0, first: first?.month, last: last?.month, latest: last };
}

// Full taxonomy for the trend picker (colors, labels, approx flags). The
// picker shows every tech, including ones absent from a given thread.
export async function getTechs() {
  const { data } = await supabase
    .from("techs")
    .select("slug, name, category, color, approx, featured")
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  return data ?? [];
}

// List of threads for the month dropdown.
export async function getThreads() {
  const { data } = await supabase
    .from("threads").select("id, month, post_count, num_comments, hn_points")
    .order("month", { ascending: false });
  return data ?? [];
}

// Bars for one thread, optionally filtered to a category, joined to tech meta.
export async function getThreadCounts(threadId: number, category?: "language" | "framework") {
  let q = supabase
    .from("thread_tech_counts")
    .select("post_count, pct, techs!inner(slug, name, category, color, approx, featured)")
    .eq("thread_id", threadId)
    .order("post_count", { ascending: false });
  if (category) q = q.eq("techs.category", category);
  const { data } = await q;
  return data ?? [];
}

// Trend: pct of each selected tech across a month range. Tiny payload.
export async function getTrend(slugs: string[], fromMonth: string, toMonth?: string) {
  let q = supabase
    .from("thread_tech_counts")
    .select("pct, post_count, tech_slug, threads!inner(month)")
    .in("tech_slug", slugs)
    .gte("threads.month", fromMonth);
  if (toMonth) q = q.lte("threads.month", toMonth);
  const { data } = await q.order("month", { ascending: true, foreignTable: "threads" });
  return data ?? [];
}

// Posts mentioning a tech in a given thread (the click-to-load feature).
export async function getPostsForTech(threadId: number, slug: string, limit = 10, offset = 0) {
  const { data, count } = await supabase
    .from("posts")
    .select("id, title, author, body, is_remote, salary_min, salary_max, salary_currency, post_techs!inner(tech_slug)", { count: "exact" })
    .eq("thread_id", threadId)
    .eq("post_techs.tech_slug", slug)
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  return { posts: data ?? [], total: count ?? 0 };
}
