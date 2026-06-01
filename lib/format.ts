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

export function esc(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );
}
