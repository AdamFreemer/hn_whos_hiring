"use client";

import { useEffect, useState } from "react";
import type { BarDatum } from "@/lib/types";

// Ranked horizontal bars for one thread + category. Featured techs highlighted,
// approx techs flagged with ≈, every bar clickable. Fills animate from 0 on
// mount (and on thread/category change, via a `key` on this component).
export default function Bars({
  rows,
  selectedSlug,
  onSelect,
  sparkBySlug,
}: {
  rows: BarDatum[];
  selectedSlug: string | null;
  onSelect: (row: BarDatum) => void;
  // trailing ~12-month pct history per slug (oldest → newest), for the sparkline
  sparkBySlug?: Record<string, number[]>;
}) {
  const [animate, setAnimate] = useState(false);
  const max = Math.max(1, ...rows.map((r) => r.n));

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="bars">
      {rows.map((r, i) => {
        const target = (r.n / max) * 100;
        const cls = [
          "bar-row",
          r.featured ? "feat" : "",
          r.slug === selectedSlug ? "sel" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={r.slug}
            type="button"
            className={cls}
            aria-pressed={r.slug === selectedSlug}
            onClick={() => onSelect(r)}
          >
            <span className="name">
              {r.name}
              {r.approx && (
                <span
                  className="approx"
                  title="collides with common words — upper bound"
                >
                  {" "}
                  ≈
                </span>
              )}
            </span>
            <span className="track">
              <span
                className="fill"
                style={{
                  width: animate ? `${target}%` : 0,
                  transitionDelay: `${i * 35}ms`,
                }}
              />
            </span>
            <span className="val">
              <b>{r.n}</b> · {r.pct.toFixed(0)}%
            </span>
            <Sparkline values={sparkBySlug?.[r.slug]} />
          </button>
        );
      })}
    </div>
  );
}

// Tiny inline bar-chart of a tech's last ~12 months of share, scaled to its own
// max so the shape reads at a glance; the final (selected-month) bar is
// highlighted. Decorative — the row already states the current count + pct.
function Sparkline({ values }: { values?: number[] }) {
  if (!values || values.length < 2) return <span className="spark" />;
  const W = 72;
  const H = 22;
  const gap = 2;
  const n = values.length;
  const bw = (W - (n - 1) * gap) / n;
  const max = Math.max(...values, 0.0001);
  return (
    <svg
      className="spark"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {values.map((v, i) => {
        const bh = v > 0 ? Math.max(1.5, (v / max) * H) : 0;
        const last = i === n - 1;
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={H - bh}
            width={bw}
            height={bh}
            className={last ? "sb last" : "sb"}
          />
        );
      })}
    </svg>
  );
}
