import type { Overview, Thread } from "@/lib/types";
import { fmtMonth, monthSpan } from "@/lib/format";

export default function StatRow({
  overview,
  threads,
}: {
  overview: Overview;
  threads: Thread[];
}) {
  const first = overview.first ?? threads[threads.length - 1]?.month;
  const last = overview.last ?? threads[0]?.month;
  const latest = overview.latest;
  const months = first && last ? monthSpan(first, last) : 0;

  return (
    <div className="stats">
      <div className="stat accent">
        <div className="label">Monthly threads</div>
        <div className="big">{overview.total}</div>
        <div className="sub">posted by whoishiring</div>
      </div>
      <div className="stat">
        <div className="label">First thread</div>
        <div className="big" style={{ fontSize: 30 }}>
          {first ? fmtMonth(first) : "—"}
        </div>
        <div className="sub">the run begins</div>
      </div>
      <div className="stat">
        <div className="label">Most recent</div>
        <div className="big" style={{ fontSize: 30 }}>
          {last ? fmtMonth(last) : "—"}
        </div>
        <div className="sub">
          {latest
            ? `${latest.post_count} job posts · ${latest.hn_points} pts`
            : " "}
        </div>
      </div>
      <div className="stat">
        <div className="label">Span</div>
        <div className="big" style={{ fontSize: 30 }}>
          {Math.floor(months / 12)}
          <small>y</small> {months % 12}
          <small>m</small>
        </div>
        <div className="sub">{months} months elapsed</div>
      </div>
    </div>
  );
}
