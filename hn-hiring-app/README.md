# HN "Who is hiring?" analytics

Scrape the monthly `whoishiring` threads once on a schedule, store normalized
data in Supabase, and serve a React app on Vercel that reads **pre-aggregated**
counts. The browser never touches Algolia, so the data layer is no longer
fragile and the "All months" view is instant.

```
Vercel Cron (*/30)  ──GET──▶  /api/cron/ingest  ──service role──▶  Supabase (Postgres)
   (Pro plan)                  discover + scrape                     threads / posts /
                               with backoff                          post_techs / thread_tech_counts
                                                                            │
                                                            anon (read-only, RLS) │
                                                                            ▼
                                            Next.js pages on Vercel  ◀──  charts + bars + post lists
```

Why this split: on Vercel **Pro**, cron can fire as often as every minute and
functions run up to 300s, so the scraper lives happily in a Next.js route. (On
the Hobby plan, cron is limited to once per day, which would break the
release-day scraping cadence; that's the only reason this would otherwise need
Supabase Cron / pg_cron.)

## Files

- `supabase/schema.sql` — tables, indexes, RLS, the tech taxonomy seed, and
  `threads_due_for_scrape()`. Run it once in the Supabase SQL editor.
- `web/lib/techs.ts` — the matching dictionary (post-level, word-boundary regex)
  plus HTML stripping and best-effort remote/salary parsing.
- `web/app/api/cron/ingest/route.ts` — the scraper: discover → scrape due
  threads → upsert posts / post_techs / counts → update bookkeeping.
- `web/lib/queries.ts` — browser reads against the small aggregate tables.
- `web/vercel.json` — the cron schedule.
- `web/.env.example` — env vars.

## Data model

`threads` (one per month) → `posts` (top-level job listings, raw body kept) →
`post_techs` (M2M) → `thread_tech_counts` (the table the charts read).
Raw bodies are stored so you can change the taxonomy and **reprocess without
re-scraping**.

## The scraping schedule (decaying)

The cron fires every 30 min, but `threads_due_for_scrape()` decides what
actually gets scraped, by thread age:

| Thread age        | Re-scrape cadence | Why                                   |
|-------------------|-------------------|---------------------------------------|
| new (unscraped)   | immediately       | picked up the moment it's posted      |
| < 48h             | every ~2h         | release day + next days, the fill window |
| < 14 days         | every ~12h        | HN still accepts comments for ~2 weeks |
| < 35 days         | daily             | late stragglers / edits               |
| ≥ 35 days         | never (archived)  | thread is frozen                      |

So on release day the latest thread gets scraped ~12×, tapering to daily, then
freezing. Tune the intervals in the SQL function.

## Rate limiting

The Algolia HN API is free and keyless, and steady-state volume here is tiny
(one thread = one or two page requests, a handful of times a day). Safeguards:

- `getJSON()` does exponential backoff on 429 / 5xx (400ms → 800ms → 1.6s).
- Short sleeps between pages (120ms) and between threads (150ms).
- Backfill is throttled and chunked (`limit` threads per call) so the one-time
  history load never bursts.

## Setup

1. **Supabase**: create a project, open the SQL editor, paste `supabase/schema.sql`, run.
2. **App**: scaffold Next.js (App Router) in `web/`, `npm i @supabase/supabase-js`,
   drop in the `lib/` files and the cron route, copy `.env.example` → `.env.local`
   and fill it in.
3. **Deploy** to Vercel (Pro). Add the four env vars (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
   plus `CRON_SECRET`. `vercel.json` registers the cron automatically on deploy.
4. **Backfill history once**:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://YOUR_APP.vercel.app/api/cron/ingest?mode=backfill&limit=50"
   ```
   Repeat until it reports `scraped: 0`. After that the every-30-min tick keeps
   the current thread fresh and leaves the archived ones alone.

## Notes / next steps

- The matching dictionary is duplicated conceptually with the `techs` table
  (code holds the regex, DB holds labels/colors). If you later want to edit
  matching without a redeploy, move the patterns into the table and compile
  them in the route.
- Salary/remote parsing is deliberately minimal; bodies are stored raw so you
  can iterate on parsing and reprocess.
- The existing single-file HTML report can be ported to these queries almost
  verbatim: the bars read `getThreadCounts`, the trend reads `getTrend`, and the
  click-to-load posts read `getPostsForTech`.

---

## Building this with Claude Code

This package is meant to be dropped into a fresh repo and built out by Claude Code.

1. `CLAUDE.md` (repo root) — read automatically by Claude Code; project context,
   stack, repo map, and the hard rules.
2. `docs/BUILD_PLAN.md` — the phased, step-by-step build spec. Start here and
   work top to bottom.
3. `reference/prototype.html` — the working single-file prototype. Open it in a
   browser to see the exact UI and behavior to port. It's the design source of truth.
4. `reference/data-notes.md` — durable facts + the counting methodology.
5. `reference/theme.css` — the design tokens.

Suggested kickoff prompt for Claude Code:

> Read CLAUDE.md and docs/BUILD_PLAN.md. Open reference/prototype.html to see the
> target UI. Then execute the build plan starting at Phase 1. The files under
> web/lib, web/app/api/cron/ingest, web/vercel.json and supabase/schema.sql are
> provided and correct — wire them in rather than rewriting them. Pause after each
> phase's acceptance criteria.

### Package contents

```
CLAUDE.md                            # Claude Code context + guardrails
README.md                            # this file
.gitignore
docs/BUILD_PLAN.md                   # phased build instructions
reference/prototype.html             # working prototype (design + logic)
reference/data-notes.md              # facts + methodology
reference/theme.css                  # design tokens
supabase/schema.sql                  # full DB schema (tables, RLS, seed, due-fn, subscribers)
web/lib/techs.ts                     # matching dictionary + parse helpers (done)
web/lib/queries.ts                   # browser read queries (done)
web/app/api/cron/ingest/route.ts     # the scraper (done)
web/vercel.json                      # cron schedule
web/.env.example                     # env template
```
