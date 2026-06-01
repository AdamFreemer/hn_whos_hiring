"use client";

import { useCallback, useMemo, useState } from "react";
import { getThreadCounts } from "@/lib/queries";
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
import TrendExplorer from "./TrendExplorer";

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

  const currentCounts = cache[threadId];
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
    </>
  );
}
