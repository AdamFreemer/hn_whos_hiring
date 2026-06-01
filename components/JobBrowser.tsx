"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPostsMatching } from "@/lib/queries";
import type { Tech, Thread, Post } from "@/lib/types";
import { esc, fmtMonth } from "@/lib/format";

const DEFAULT_SLUGS = ["python", "javascript", "java", "ruby", "rails", "django"];
const PAGE = 15;
const FALLBACK_COLOR = "#8f8473";

type JobPost = Post & { post_techs: { tech_slug: string }[] };

function lines(body: string): string[] {
  return body.split("\n").map((s) => s.trim()).filter(Boolean);
}

function fmtSalary(p: Post): string | null {
  if (p.salary_min == null) return null;
  const cur =
    p.salary_currency === "USD"
      ? "$"
      : p.salary_currency === "EUR"
      ? "€"
      : p.salary_currency === "GBP"
      ? "£"
      : "";
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
  return p.salary_max
    ? `${cur}${k(p.salary_min)}–${cur}${k(p.salary_max)}`
    : `${cur}${k(p.salary_min)}`;
}

// A standalone HTML doc listing every matching post — the "open all" view.
function standalone(
  label: string,
  posts: JobPost[],
  monthLabel: string
): string {
  const items = posts
    .map((p, i) => {
      const ls = lines(p.body);
      const title = esc(ls[0] || p.body.slice(0, 120));
      const body = esc(ls.slice(1).join("\n")).replace(/\n/g, "<br>");
      return `<article><h2>${i + 1}. ${title}</h2>${
        body ? `<p>${body}</p>` : ""
      }<div class="meta">by ${esc(p.author || "anon")} · <a href="https://news.ycombinator.com/item?id=${p.id}" target="_blank">read on HN ↗</a></div></article>`;
    })
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(label)} · ${esc(monthLabel)} · Who is hiring</title>
  <style>
    body{margin:0;background:#0e0c0a;color:#ece4d6;font:15px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;padding:40px 20px 80px}
    .wrap{max-width:840px;margin:0 auto}
    h1{font:600 26px/1.2 Fraunces,Georgia,serif;margin:0 0 6px}
    h1 b{color:#ff8a3d}
    .sub{color:#8f8473;font-size:13px;margin-bottom:30px;border-bottom:1px solid #2c241b;padding-bottom:18px}
    article{border:1px solid #2c241b;background:#16120d;padding:16px 18px;margin-bottom:12px}
    h2{font:600 15px/1.4 "IBM Plex Mono",monospace;margin:0 0 8px;color:#ece4d6}
    p{margin:0;color:#b8ad9b;font-size:13.5px;white-space:normal}
    .meta{margin-top:12px;font-size:12px;color:#5f574a}
    .meta a{color:#ff8a3d;text-decoration:none}
    @media print{body{background:#fff;color:#000}article{border-color:#ccc;background:#fff}}
  </style></head><body><div class="wrap">
  <h1>Posts matching <b>${esc(label)}</b></h1>
  <div class="sub">${posts.length} job posts · Ask HN: Who is hiring? (${esc(
    monthLabel
  )})</div>
  ${items}
  </div></body></html>`;
}

export default function JobBrowser({
  threads,
  techs,
}: {
  threads: Thread[];
  techs: Tech[];
}) {
  const techBySlug = useMemo(
    () => new Map(techs.map((t) => [t.slug, t])),
    [techs]
  );
  const langs = useMemo(
    () => techs.filter((t) => t.category === "language"),
    [techs]
  );
  const frameworks = useMemo(
    () => techs.filter((t) => t.category === "framework"),
    [techs]
  );

  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState(threads[0]?.id);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(DEFAULT_SLUGS.filter((s) => techs.some((t) => t.slug === s)))
  );
  const [remote, setRemote] = useState(false);
  const [hasSalary, setHasSalary] = useState(false);
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const reqId = useRef(0);

  const slugs = useMemo(() => [...selected].sort(), [selected]);
  const slugKey = slugs.join(",");
  const month = useMemo(
    () => threads.find((t) => t.id === threadId)?.month ?? threads[0]?.month,
    [threads, threadId]
  );

  const opts = useMemo(() => ({ remote, hasSalary }), [remote, hasSalary]);

  // (re)load the first page whenever the query changes
  useEffect(() => {
    if (!open || !threadId || !slugs.length) {
      setPosts([]);
      setTotal(0);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    getPostsMatching(threadId, slugs, opts, PAGE, 0).then((res) => {
      if (id !== reqId.current) return;
      setPosts(res.posts as JobPost[]);
      setTotal(res.total);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, threadId, slugKey, remote, hasSalary]);

  const showMore = useCallback(async () => {
    if (!threadId) return;
    setLoadingMore(true);
    const res = await getPostsMatching(threadId, slugs, opts, PAGE, posts.length);
    setPosts((prev) => [...prev, ...(res.posts as JobPost[])]);
    setLoadingMore(false);
  }, [threadId, slugs, opts, posts.length]);

  const openAll = useCallback(async () => {
    if (!threadId || !month) return;
    const res = await getPostsMatching(threadId, slugs, opts, total || PAGE, 0);
    const label = slugs.map((s) => techBySlug.get(s)?.name ?? s).join(" / ");
    const html = standalone(label, res.posts as JobPost[], fmtMonth(month));
    let win: Window | null = null;
    try {
      win = window.open("", "_blank");
    } catch {
      win = null;
    }
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  }, [threadId, slugs, opts, total, month, techBySlug]);

  const toggle = (slug: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  return (
    <section id="jobs">
      <div className="sec-head">
        <h2>Browse the postings</h2>
        <div className="meta">Job posts matching any of your selected stack</div>
      </div>

      {!open ? (
        <div>
          <button onClick={() => setOpen(true)}>▶ Open job browser</button>
        </div>
      ) : (
        <div>
          <div className="picker">
            <div className="grp">
              <span className="gh">Languages</span>
              {langs.map((t) => (
                <Chk
                  key={t.slug}
                  tech={t}
                  on={selected.has(t.slug)}
                  onToggle={toggle}
                />
              ))}
            </div>
            <div className="grp">
              <span className="gh">Frameworks</span>
              {frameworks.map((t) => (
                <Chk
                  key={t.slug}
                  tech={t}
                  on={selected.has(t.slug)}
                  onToggle={toggle}
                />
              ))}
            </div>
            <div className="pickrow">
              <button
                className="mini"
                onClick={() =>
                  setSelected(
                    new Set(DEFAULT_SLUGS.filter((s) => techBySlug.has(s)))
                  )
                }
              >
                My picks
              </button>
              <button className="mini" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
          </div>

          <div className="controls">
            <label className="cl" htmlFor="jobMonth">
              Thread
            </label>
            <select
              id="jobMonth"
              value={threadId}
              onChange={(e) => setThreadId(Number(e.target.value))}
            >
              {threads.map((t, i) => (
                <option key={t.id} value={t.id}>
                  {fmtMonth(t.month)}
                  {i === 0 ? "  (latest)" : ""}
                </option>
              ))}
            </select>
            <div className="spacer" />
            <div className="toggle">
              <button
                className={remote ? "on" : ""}
                onClick={() => setRemote((v) => !v)}
              >
                Remote only
              </button>
            </div>
            <div className="toggle">
              <button
                className={hasSalary ? "on" : ""}
                onClick={() => setHasSalary((v) => !v)}
              >
                Has salary
              </button>
            </div>
          </div>

          {!slugs.length ? (
            <p className="hint">↳ Select one or more technologies to load postings.</p>
          ) : loading ? (
            <div className="loading">
              <span className="dot" /> Loading postings…
            </div>
          ) : (
            <div className="posts-box" style={{ borderTopColor: "var(--line)" }}>
              <div className="ph">
                <span>
                  <b style={{ color: "var(--accent-soft)" }}>{total}</b> matching
                  {remote ? " remote" : ""} post{total === 1 ? "" : "s"} in{" "}
                  {month ? fmtMonth(month) : ""}
                  {hasSalary ? " with a salary" : ""}
                </span>
                {total > 0 && (
                  <a onClick={openAll}>Open all {total} in a new tab ↗</a>
                )}
              </div>
              <div>
                {posts.map((p) => (
                  <JobCard key={p.id} p={p} techBySlug={techBySlug} />
                ))}
                {total === 0 && (
                  <div className="post">
                    <div className="s">
                      No posts match this combination. Try fewer filters or more
                      technologies.
                    </div>
                  </div>
                )}
              </div>
              {posts.length < total && (
                <div style={{ marginTop: 12 }}>
                  <button onClick={showMore} disabled={loadingMore}>
                    {loadingMore
                      ? "Loading…"
                      : `Show ${Math.min(PAGE, total - posts.length)} more`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function JobCard({
  p,
  techBySlug,
}: {
  p: JobPost;
  techBySlug: Map<string, Tech>;
}) {
  const ls = lines(p.body);
  let title = p.title || ls[0] || p.body.slice(0, 100);
  if (title.length > 140) title = title.slice(0, 140) + "…";
  let snip = ls.slice(1).join(" ");
  if (snip.length > 240) snip = snip.slice(0, 240) + "…";
  const salary = fmtSalary(p);
  const matched = p.post_techs
    .map((pt) => techBySlug.get(pt.tech_slug))
    .filter((t): t is Tech => Boolean(t));

  return (
    <div className="post">
      <div className="t">{title}</div>
      {snip && <div className="s">{snip}</div>}
      <div className="m">
        <span>by {p.author || "anon"}</span>
        {p.is_remote && <span className="tag">Remote</span>}
        {salary && <span className="tag">{salary}</span>}
        {matched.map((t) => (
          <span key={t.slug} className="jt">
            <i style={{ background: t.color ?? FALLBACK_COLOR }} />
            {t.name}
          </span>
        ))}
        <a
          href={`https://news.ycombinator.com/item?id=${p.id}`}
          target="_blank"
          rel="noopener"
          style={{ marginLeft: "auto" }}
        >
          read on HN ↗
        </a>
      </div>
    </div>
  );
}

function Chk({
  tech,
  on,
  onToggle,
}: {
  tech: Tech;
  on: boolean;
  onToggle: (slug: string) => void;
}) {
  return (
    <label className={`chk ${on ? "on" : ""}`}>
      <input type="checkbox" checked={on} onChange={() => onToggle(tech.slug)} />
      <span className="sw" style={{ background: tech.color ?? FALLBACK_COLOR }} />
      {tech.name}
      {tech.approx ? " ≈" : ""}
    </label>
  );
}
