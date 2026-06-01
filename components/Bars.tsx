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
}: {
  rows: BarDatum[];
  selectedSlug: string | null;
  onSelect: (row: BarDatum) => void;
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
          </button>
        );
      })}
    </div>
  );
}
