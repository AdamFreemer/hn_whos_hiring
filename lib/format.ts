export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// month strings are 'YYYY-MM-01' (UTC); read them as UTC to avoid TZ drift.
export function fmtMonth(month: string): string {
  const d = new Date(month);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// compact axis label, e.g. "A24" for Apr 2024
export function shortLabel(month: string): string {
  const d = new Date(month);
  return MONTHS[d.getUTCMonth()][0] + String(d.getUTCFullYear()).slice(2);
}

// whole-month span between two 'YYYY-MM-01' strings
export function monthSpan(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth())
  );
}

// "Jun 1, 2026" — deterministic absolute date (no "now" needed).
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// Friendly "2 hours ago" relative to a caller-supplied now (client-only, to
// avoid SSR/hydration drift). Falls back to an absolute date past ~30 days.
export function relativeTime(iso: string, nowMs: number): string {
  const sec = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (sec < 90) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 30) return `${day} days ago`;
  return fmtDate(iso);
}

// When the next monthly thread is expected: the 1st of the month after the
// latest thread's month.
export function nextRelease(latestMonth: string, nowMs: number) {
  const d = new Date(latestMonth);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const days = Math.ceil((next.getTime() - nowMs) / 86400000);
  return {
    label: `${MONTHS[next.getUTCMonth()]} ${next.getUTCFullYear()}`,
    dateLabel: `${MONTHS[next.getUTCMonth()]} 1`,
    days,
  };
}

export function esc(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );
}
