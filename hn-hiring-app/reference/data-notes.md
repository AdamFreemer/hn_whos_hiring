# Data notes (durable facts + methodology)

Keep these; they're the reasoning behind the schema and matching logic.

## The threads

- The `whoishiring` account has posted "Ask HN: Who is hiring?" monthly since
  **April 2011**. As of mid-2026 that's ~180+ threads (roughly 182 months).
- That account posts three threads a month: "Who is hiring?", "Who wants to be
  hired?", and "Freelancer? Seeking freelancer?". **We use only the "Who is
  hiring?" threads** — filter by title containing "who is hiring" (case-insensitive).
- The app does not hard-code the count or the start date; it derives them live
  from the account's story list and stores them.
- Example anchor: the May 2026 thread is HN story id `47975571`, by `whoishiring`,
  ~558 comments (comment count includes replies; our `post_count` is top-level
  job posts only).

## HN Algolia API (the only data source)

Free, keyless, CORS-enabled. Base: `https://hn.algolia.com/api/v1/search`.

- All threads by the account: `?tags=author_whoishiring,story&hitsPerPage=1000`
  then filter titles. (Account total is well under 1000, but paginate via
  `nbPages` to be safe.)
- A thread's comments: `?tags=comment,story_<STORY_ID>&hitsPerPage=1000`,
  paginate via `nbPages`. **Top-level job posts** are the hits where
  `parent_id === <STORY_ID>`. Replies are excluded.
- `comment_text` is HTML (with entities and `<p>`/`<a>` tags); strip to plain
  text before matching. `<p>` marks paragraph breaks (treat as newlines) so the
  first line can be used as the post title.
- Back off on HTTP 429 / 5xx. Steady-state volume is tiny; the only burst is the
  one-time backfill, which is throttled.

## Counting methodology

- **Post-level counts**: a technology scores once per top-level job post whose
  text matches, not once per raw occurrence. This mirrors hntrends.com and stops
  a single verbose listing from skewing totals. `pct` = matching posts / total
  posts in that thread.
- Matching is **case-insensitive on word boundaries**.
- `Java` uses `\bjava\b`, which does NOT match "javascript" (no word boundary
  before "script"), so the two never collide.
- `JavaScript` counts the literal word "javascript", NOT "JS", to avoid
  double-counting "Node.js" / "Next.js".
- **Approximate labels** collide with ordinary English and are upper bounds:
  `Go` (matches the verb), `C` (the letter), `Spring` (the season), `Express`,
  `Phoenix` (the city). Flagged `approx=true`; show with a `≈` marker, never drop.
- Bodies are stored raw, so if the taxonomy changes you can re-run matching and
  rebuild `post_techs` / `thread_tech_counts` without re-scraping HN.

## Scrape cadence (and why)

HN accepts comments on a thread for ~2 weeks, then it freezes. So a thread fills
fast in its first days and is effectively final by ~14 days. The decaying
schedule in `threads_due_for_scrape()` reflects that:

| Age      | Cadence      |
|----------|--------------|
| new      | immediately  |
| < 48h    | every ~2h    |
| < 14d    | every ~12h   |
| < 35d    | daily        |
| ≥ 35d    | archived     |

## Positioning (free competitors)

The space is crowded with free tools: hnhiring.com (indexes all jobs back to
Jan 2018), hntrends.com (tech popularity trends), and several in-thread searchers
the moderators link (nthesis.ai, dheerajck's, nchelluri's hnjobs, hnjobs.emilburzo.com).
Implication: HN data itself is not a moat. The value is distribution (a developer
audience you can put a sponsor in front of) or a B2B hiring-signal data product,
not a consumer micro-subscription. Launch free, build an opt-in list, decide later.
