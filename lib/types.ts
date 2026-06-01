// Shared shapes for the values returned by lib/queries.ts. Supabase types its
// nested relations loosely, so the joined relation can come back as either a
// single object or a one-element array depending on version — `one()` below
// normalizes that.

export type Category = "language" | "framework";

export type Tech = {
  slug: string;
  name: string;
  category: Category;
  color: string | null;
  approx: boolean;
  featured: boolean;
};

export type Thread = {
  id: number;
  month: string; // 'YYYY-MM-01'
  post_count: number;
  num_comments: number;
  hn_points: number;
};

export type Overview = {
  total: number;
  first?: string | null;
  last?: string | null;
  latest?: { month: string; post_count: number; hn_points: number } | null;
};

export type CountRow = {
  post_count: number;
  pct: number;
  techs: Tech | Tech[];
};

export type TrendRow = {
  pct: number;
  post_count: number;
  tech_slug: string;
  threads: { month: string } | { month: string }[];
};

export type Post = {
  id: number;
  title: string | null;
  author: string | null;
  body: string;
  is_remote: boolean | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
};

// A bar in the analysis chart: a tech plus its count for the selected thread.
export type BarDatum = Tech & { n: number; pct: number };

// Normalize a Supabase nested relation that may be an object or a 1-elem array.
export function one<T>(rel: T | T[] | null | undefined): T | undefined {
  if (rel == null) return undefined;
  return Array.isArray(rel) ? rel[0] : rel;
}
