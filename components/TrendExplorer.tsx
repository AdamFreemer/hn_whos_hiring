"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTrend } from "@/lib/queries";
import type { Tech, TrendRow } from "@/lib/types";
import { one } from "@/lib/types";
import { fmtMonth, shortLabel } from "@/lib/format";

type Range = "6m" | "1y" | "2y" | "all" | "custom";
const DEFAULT_SLUGS = ["python", "javascript", "java", "ruby", "rails", "django"];
const FALLBACK_COLOR = "#8f8473";

type Point = { month: string; short: string; vals: Record<string, number> };

export default function TrendExplorer({
  threads,
  techs,
  topSlugs,
}: {
  threads: { month: string }[];
  techs: Tech[];
  topSlugs: string[];
}) {
  const monthsDesc = useMemo(() => threads.map((t) => t.month), [threads]);
  const allSlugs = useMemo(() => techs.map((t) => t.slug), [techs]);
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
  const [range, setRange] = useState<Range>("1y");
  const [customFrom, setCustomFrom] = useState(
    monthsDesc[Math.min(11, monthsDesc.length - 1)] ?? monthsDesc[0]
  );
  const [customTo, setCustomTo] = useState(monthsDesc[0]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(DEFAULT_SLUGS.filter((s) => techs.some((t) => t.slug === s)))
  );
  const [series, setSeries] = useState<Point[] | null>(null);
  const [status, setStatus] = useState("");
  const reqId = useRef(0);

  // Resolve the [from, to] month bounds for the active range.
  const bounds = useCallback((): { from: string; to: string } => {
    if (range === "custom") {
      const lo = customFrom <= customTo ? customFrom : customTo;
      const hi = customFrom <= customTo ? customTo : customFrom;
      return { from: lo, to: hi };
    }
    const n =
      range === "6m" ? 6 : range === "1y" ? 12 : range === "2y" ? 24 : monthsDesc.length;
    const slice = monthsDesc.slice(0, n);
    return { from: slice[slice.length - 1], to: slice[0] };
  }, [range, customFrom, customTo, monthsDesc]);

  // Fetch the trend for ALL techs over the range; toggling checkboxes then just
  // redraws (no refetch). Changing the range refetches.
  const fetchRange = useCallback(async () => {
    if (!monthsDesc.length) return;
    const { from, to } = bounds();
    const monthsAsc = monthsDesc
      .filter((m) => m >= from && m <= to)
      .sort();
    if (!monthsAsc.length) {
      setSeries([]);
      setStatus("no threads in range");
      return;
    }
    const id = ++reqId.current;
    setStatus("loading…");
    const rows = (await getTrend(allSlugs, from, to)) as TrendRow[];
    if (id !== reqId.current) return; // a newer request superseded this one
    const lookup = new Map<string, number>();
    for (const r of rows) {
      const month = one(r.threads)?.month;
      if (month) lookup.set(`${month}|${r.tech_slug}`, Number(r.pct));
    }
    const points: Point[] = monthsAsc.map((month) => {
      const vals: Record<string, number> = {};
      for (const slug of allSlugs) vals[slug] = lookup.get(`${month}|${slug}`) ?? 0;
      return { month, short: shortLabel(month), vals };
    });
    setSeries(points);
    setStatus(`${points.length} threads`);
  }, [bounds, monthsDesc, allSlugs]);

  useEffect(() => {
    if (open) fetchRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, range, customFrom, customTo]);

  const toggle = (slug: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  const setPicks = (slugs: string[]) => setSelected(new Set(slugs));

  return (
    <section id="trend">
      <div className="sec-head">
        <h2>Trend over time</h2>
        <div className="meta">Share of job posts mentioning each, by month</div>
      </div>

      {!open ? (
        <div>
          <button onClick={() => setOpen(true)}>▶ Open trend explorer</button>
        </div>
      ) : (
        <div>
          <div className="picker">
            <div className="grp">
              <span className="gh">Languages</span>
              {langs.map((t) => (
                <Chk key={t.slug} tech={t} on={selected.has(t.slug)} onToggle={toggle} />
              ))}
            </div>
            <div className="grp">
              <span className="gh">Frameworks</span>
              {frameworks.map((t) => (
                <Chk key={t.slug} tech={t} on={selected.has(t.slug)} onToggle={toggle} />
              ))}
            </div>
            <div className="pickrow">
              <button
                className="mini"
                onClick={() =>
                  setPicks(DEFAULT_SLUGS.filter((s) => techBySlug.has(s)))
                }
              >
                My picks
              </button>
              <button
                className="mini"
                onClick={() => setPicks(topSlugs.slice(0, 6))}
              >
                Top 6 (this thread)
              </button>
              <button className="mini" onClick={() => setPicks([])}>
                Clear
              </button>
            </div>
          </div>

          <div className="controls">
            <label className="cl">Range</label>
            <div className="toggle">
              {(["6m", "1y", "2y", "all", "custom"] as Range[]).map((r) => (
                <button
                  key={r}
                  className={range === r ? "on" : ""}
                  onClick={() => setRange(r)}
                >
                  {r === "6m"
                    ? "6 mo"
                    : r === "1y"
                    ? "1 yr"
                    : r === "2y"
                    ? "2 yr"
                    : r === "all"
                    ? "All"
                    : "Custom"}
                </button>
              ))}
            </div>
            {range === "custom" && (
              <span className="custom-range">
                <MonthSelect
                  months={monthsDesc}
                  value={customFrom}
                  onChange={setCustomFrom}
                />
                <span style={{ color: "var(--faint)" }}>→</span>
                <MonthSelect
                  months={monthsDesc}
                  value={customTo}
                  onChange={setCustomTo}
                />
              </span>
            )}
            <span className="trend-status">{status}</span>
          </div>

          {series && (
            <div className="trend-wrap">
              <Chart
                series={series}
                techs={techs.filter((t) => selected.has(t.slug))}
              />
              <div className="legend">
                {techs
                  .filter((t) => selected.has(t.slug))
                  .map((t) => (
                    <span key={t.slug}>
                      <i style={{ background: t.color ?? FALLBACK_COLOR }} />
                      {t.name}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
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

function MonthSelect({
  months,
  value,
  onChange,
}: {
  months: string[];
  value: string;
  onChange: (m: string) => void;
}) {
  // oldest → newest in the dropdown
  const asc = [...months].sort();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {asc.map((m) => (
        <option key={m} value={m}>
          {fmtMonth(m)}
        </option>
      ))}
    </select>
  );
}

function Chart({ series, techs }: { series: Point[]; techs: Tech[] }) {
  const W = 820, H = 340, padL = 44, padR = 16, padT = 18, padB = 46;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxPct =
    Math.max(8, ...series.flatMap((p) => techs.map((t) => p.vals[t.slug] || 0))) *
    1.12;
  const x = (i: number) =>
    padL + (series.length <= 1 ? innerW / 2 : (innerW * i) / (series.length - 1));
  const y = (v: number) => padT + innerH - (v / maxPct) * innerH;
  const step = Math.max(1, Math.ceil(series.length / 12));

  return (
    <svg
      className="trend-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Share of job posts mentioning each selected technology, by month"
    >
      {[0, 1, 2, 3, 4].map((g) => {
        const v = (maxPct * g) / 4;
        const yy = y(v);
        return (
          <g key={g}>
            <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#2c241b" />
            <text
              x={padL - 8}
              y={yy + 4}
              fill="#5f574a"
              fontSize="11"
              textAnchor="end"
              fontFamily="var(--mono)"
            >
              {v.toFixed(0)}%
            </text>
          </g>
        );
      })}
      {series.map((p, i) =>
        i % step === 0 || i === series.length - 1 ? (
          <text
            key={p.month}
            x={x(i)}
            y={H - padB + 22}
            fill="#8f8473"
            fontSize="10.5"
            textAnchor="middle"
            fontFamily="var(--mono)"
          >
            {p.short}
          </text>
        ) : null
      )}
      {techs.map((t) => {
        const color = t.color ?? FALLBACK_COLOR;
        const pts = series
          .map((p, i) => `${x(i)},${y(p.vals[t.slug] || 0)}`)
          .join(" ");
        return (
          <g key={t.slug}>
            <polyline
              points={pts}
              fill="none"
              stroke={color}
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {series.length <= 26 &&
              series.map((p, i) => (
                <circle
                  key={p.month}
                  cx={x(i)}
                  cy={y(p.vals[t.slug] || 0)}
                  r="2.8"
                  fill={color}
                />
              ))}
          </g>
        );
      })}
      {!techs.length && (
        <text
          x={W / 2}
          y={H / 2}
          fill="#5f574a"
          fontSize="13"
          textAnchor="middle"
          fontFamily="var(--mono)"
        >
          select one or more technologies above
        </text>
      )}
    </svg>
  );
}
