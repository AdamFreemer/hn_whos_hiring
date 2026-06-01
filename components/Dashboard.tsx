"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getThreadCounts, getTrend } from "@/lib/queries";
import type { TrendRow } from "@/lib/types";
import type {
  BarDatum,
  Category,
  CountRow,
  Overview,
  Tech,
  Thread,
} from "@/lib/types";
import { one } from "@/lib/types";
import { fmtMonth } from "@/lib/format";
import StatRow from "./StatRow";
import Bars from "./Bars";
import PostsPanel from "./PostsPanel";
import Freshness from "./Freshness";
import TrendExplorer from "./TrendExplorer";
import JobBrowser from "./JobBrowser";

export default function Dashboard({
  overview,
  threads,
  techs,
  latestId,
  latestCounts,
}: {
  overview: Overview;
  threads: Thread[];
  techs: Tech[];
  latestId: number;
  latestCounts: CountRow[];
}) {
  const [cat, setCat] = useState<Category>("language");
  const [threadId, setThreadId] = useState(latestId);
  const [cache, setCache] = useState<Record<number, CountRow[]>>({
    [latestId]: latestCounts,
  });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<BarDatum | null>(null);
  // per-thread sparkline series: { [threadId]: { [slug]: pct[] (oldest→newest) } }
  const [spark, setSpark] = useState<Record<number, Record<string, number[]>>>({});

  const currentCounts = cache[threadId];
  const currentSpark = spark[threadId];
  const currentThread = useMemo(
    () => threads.find((t) => t.id === threadId) ?? threads[0],
    [threads, threadId]
  );

  // Build every tech in the category (including zero-count ones, which never
  // appear in thread_tech_counts), ranked by post count.
  const buildRows = useCallback(
    (category: Category): BarDatum[] => {
      const bySlug = new Map<string, { n: number; pct: number }>();
      for (const r of currentCounts ?? []) {
        const t = one(r.techs);
        if (t) bySlug.set(t.slug, { n: r.post_count, pct: Number(r.pct) });
      }
      return techs
        .filter((t) => t.category === category)
        .map((t) => {
          const c = bySlug.get(t.slug);
          return { ...t, n: c?.n ?? 0, pct: c?.pct ?? 0 };
        })
        .sort((a, b) => b.n - a.n);
    },
    [currentCounts, techs]
  );

  const rows = useMemo(() => buildRows(cat), [buildRows, cat]);

  // Fetch the trailing ~12-month share history (all techs) ending at the
  // selected thread, for the per-bar sparklines. One query per thread, cached.
  useEffect(() => {
    if (spark[threadId]) return;
    const idx = threads.findIndex((t) => t.id === threadId);
    if (idx < 0) return;
    const months = threads
      .slice(idx, idx + 12)
      .map((t) => t.month)
      .sort();
    if (months.length < 2) {
      setSpark((prev) => ({ ...prev, [threadId]: {} }));
      return;
    }
    let cancelled = false;
    getTrend(
      techs.map((t) => t.slug),
      months[0],
      months[months.length - 1]
    ).then((data) => {
      if (cancelled) return;
      const trendRows = data as TrendRow[];
      const lk = new Map<string, number>();
      for (const r of trendRows) {
        const m = one(r.threads)?.month;
        if (m) lk.set(`${m}|${r.tech_slug}`, Number(r.pct));
      }
      const bySlug: Record<string, number[]> = {};
      for (const t of techs) {
        bySlug[t.slug] = months.map((m) => lk.get(`${m}|${t.slug}`) ?? 0);
      }
      setSpark((prev) => ({ ...prev, [threadId]: bySlug }));
    });
    return () => {
      cancelled = true;
    };
  }, [threadId, threads, techs, spark]);

  const topSlugs = useMemo(
    () =>
      [...(currentCounts ?? [])]
        .sort((a, b) => b.post_count - a.post_count)
        .map((r) => one(r.techs)?.slug)
        .filter((s): s is string => Boolean(s))
        .slice(0, 6),
    [currentCounts]
  );

  const selectThread = useCallback(
    async (id: number) => {
      setThreadId(id);
      setSelected(null);
      if (cache[id]) return;
      setLoading(true);
      const counts = (await getThreadCounts(id)) as CountRow[];
      setCache((prev) => ({ ...prev, [id]: counts }));
      setLoading(false);
    },
    [cache]
  );

  const changeCat = (next: Category) => {
    setCat(next);
    setSelected(null);
  };

  return (
    <>
      <StatRow overview={overview} threads={threads} />

      <section id="analysis">
        <div className="sec-head">
          <h2>What a thread is asking for</h2>
          <div className="meta">
            {currentThread && (
              <>
                <b>{currentThread.post_count}</b> top-level job posts ·{" "}
                <a
                  href={`https://news.ycombinator.com/item?id=${threadId}`}
                  target="_blank"
                  rel="noopener"
                  style={{ color: "var(--muted)" }}
                >
                  view on HN ↗
                </a>
              </>
            )}
          </div>
        </div>

        <div className="controls">
          <label className="cl" htmlFor="monthSelect">
            Thread
          </label>
          <select
            id="monthSelect"
            value={threadId}
            onChange={(e) => selectThread(Number(e.target.value))}
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
              className={cat === "language" ? "on" : ""}
              onClick={() => changeCat("language")}
            >
              Languages
            </button>
            <button
              className={cat === "framework" ? "on" : ""}
              onClick={() => changeCat("framework")}
            >
              Frameworks
            </button>
          </div>
        </div>

        <p className="hint">
          ↳ Click any bar to load the matching job posts at the bottom.
        </p>

        {currentThread && (
          <Freshness
            thread={currentThread}
            isLatest={threadId === threads[0].id}
          />
        )}

        {loading || !currentCounts ? (
          <div className="loading">
            <span className="dot" /> Reading job posts…
          </div>
        ) : (
          <Bars
            key={`${threadId}-${cat}`}
            rows={rows}
            selectedSlug={selected?.slug ?? null}
            onSelect={(r) => setSelected(r)}
            sparkBySlug={currentSpark}
          />
        )}

        {selected && currentThread && (
          <PostsPanel
            threadId={threadId}
            threadMonth={currentThread.month}
            totalPosts={currentThread.post_count}
            selected={{ slug: selected.slug, name: selected.name }}
            onClose={() => setSelected(null)}
          />
        )}
      </section>

      <TrendExplorer threads={threads} techs={techs} topSlugs={topSlugs} />

      <JobBrowser threads={threads} techs={techs} />
    </>
  );
}
