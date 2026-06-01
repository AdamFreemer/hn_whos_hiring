// ---------------------------------------------------------------------------
// Tech-matching dictionary + parse helpers. Single source of truth for the
// scraper. `slug` values must match the `techs` table seeded in schema.sql.
// Counts are post-level: a tech scores once per post whose text matches.
// `test(lower, raw)` receives the lowercased body and the raw body (the raw
// form is only needed for case-sensitive matches like a bare "Go" / "C").
// ---------------------------------------------------------------------------

export type Tech = {
  slug: string;
  category: "language" | "framework";
  test: (lower: string, raw: string) => boolean;
};

export const TECHS: Tech[] = [
  // languages
  { slug: "python",     category: "language", test: l => /\bpython\b/.test(l) },
  { slug: "javascript", category: "language", test: l => /\bjavascript\b/.test(l) },
  { slug: "java",       category: "language", test: l => /\bjava\b/.test(l) }, // \b stops "javascript"
  { slug: "ruby",       category: "language", test: l => /\bruby\b/.test(l) },
  { slug: "typescript", category: "language", test: l => /\btypescript\b/.test(l) },
  { slug: "go",         category: "language", test: (l, r) => /\bgolang\b/.test(l) || /\bGo\b/.test(r) }, // approx
  { slug: "rust",       category: "language", test: l => /\brust\b/.test(l) },
  { slug: "cpp",        category: "language", test: l => /c\+\+/.test(l) },
  { slug: "csharp",     category: "language", test: l => /c#/.test(l) },
  { slug: "php",        category: "language", test: l => /\bphp\b/.test(l) },
  { slug: "swift",      category: "language", test: l => /\bswift\b/.test(l) },
  { slug: "kotlin",     category: "language", test: l => /\bkotlin\b/.test(l) },
  { slug: "scala",      category: "language", test: l => /\bscala\b/.test(l) },
  { slug: "elixir",     category: "language", test: l => /\belixir\b/.test(l) },
  { slug: "clojure",    category: "language", test: l => /\bclojure\b/.test(l) },
  { slug: "haskell",    category: "language", test: l => /\bhaskell\b/.test(l) },
  { slug: "c",          category: "language", test: (_l, r) => /\bC\b/.test(r) }, // approx
  // frameworks
  { slug: "react",   category: "framework", test: l => /\breact\b/.test(l) },
  { slug: "rails",   category: "framework", test: l => /\brails\b/.test(l) || /ruby on rails/.test(l) },
  { slug: "django",  category: "framework", test: l => /\bdjango\b/.test(l) },
  { slug: "nodejs",  category: "framework", test: l => /\bnode(\.?js)?\b/.test(l) },
  { slug: "nextjs",  category: "framework", test: l => /\bnext\.?js\b/.test(l) },
  { slug: "vue",     category: "framework", test: l => /\bvue(\.?js)?\b/.test(l) },
  { slug: "angular", category: "framework", test: l => /\bangular\b/.test(l) },
  { slug: "svelte",  category: "framework", test: l => /\bsvelte\b/.test(l) },
  { slug: "dotnet",  category: "framework", test: l => /\.net\b/.test(l) || /\bdotnet\b/.test(l) || /asp\.net/.test(l) },
  { slug: "spring",  category: "framework", test: l => /\bspring\b/.test(l) }, // approx
  { slug: "flask",   category: "framework", test: l => /\bflask\b/.test(l) },
  { slug: "fastapi", category: "framework", test: l => /\bfastapi\b/.test(l) },
  { slug: "laravel", category: "framework", test: l => /\blaravel\b/.test(l) },
  { slug: "express", category: "framework", test: l => /\bexpress\b/.test(l) }, // approx
  { slug: "phoenix", category: "framework", test: l => /\bphoenix\b/.test(l) }, // approx
];

export function techsInPost(raw: string): string[] {
  const lower = raw.toLowerCase();
  const out: string[] = [];
  for (const t of TECHS) if (t.test(lower, raw)) out.push(t.slug);
  return out;
}

// --- HTML handling (no DOM on the server) ---------------------------------
const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&#39;": "'", "&#x27;": "'", "&#x2F;": "/", "&nbsp;": " ",
};
function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m) => {
    if (ENTITIES[m] != null) return ENTITIES[m];
    const hex = m.match(/&#x([0-9a-f]+);/i);
    if (hex) return String.fromCodePoint(parseInt(hex[1], 16));
    const dec = m.match(/&#(\d+);/);
    if (dec) return String.fromCodePoint(parseInt(dec[1], 10));
    return m;
  });
}
// Algolia comment_text is HTML; <p> marks paragraph breaks (no newlines).
export function stripHtml(html: string): string {
  return decode(
    (html || "")
      .replace(/<\s*\/?p\s*>/gi, "\n")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  ).replace(/\n{3,}/g, "\n\n").trim();
}
export function firstLine(text: string): string {
  const line = text.split("\n").map(s => s.trim()).find(Boolean) || text.slice(0, 120);
  return line.length > 200 ? line.slice(0, 200) : line;
}

// --- best-effort metadata (refine later; stored raw so re-parsing is cheap) -
export function parseRemote(lower: string): boolean | null {
  if (/\bremote\b/.test(lower)) return true;
  if (/\bonsite\b/.test(lower) || /\bon-site\b/.test(lower)) return false;
  return null;
}
export function parseSalary(raw: string): { min: number | null; max: number | null; currency: string | null } {
  // matches things like "$150k - $190k", "$150,000–$190,000", "150k-190k"
  const m = raw.match(/\$?\s?(\d{2,3})\s?(?:k|,000)?\s?(?:-|–|to)\s?\$?\s?(\d{2,3})\s?(?:k|,000)?/i);
  const cur = /\$/.test(raw) ? "USD" : /€/.test(raw) ? "EUR" : /£/.test(raw) ? "GBP" : null;
  if (!m) return { min: null, max: null, currency: cur };
  const norm = (n: string) => (parseInt(n, 10) < 1000 ? parseInt(n, 10) * 1000 : parseInt(n, 10));
  return { min: norm(m[1]), max: norm(m[2]), currency: cur };
}
