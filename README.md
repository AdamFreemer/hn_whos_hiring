# The Hiring Thread, Counted

A live analysis of Hacker News' monthly **"Ask HN: Who is hiring?"** threads —
which programming languages and frameworks show up most in any given month, and
how that's trended since the series began in April 2011.

**Live:** https://hn-whos-hiring.vercel.app

The threads are scraped on a schedule, normalized into Postgres, and the site
reads **pre-aggregated** counts — the browser never calls the HN API, so the
"all months" trend is instant and the data layer isn't fragile.

```
Vercel Cron (*/30)  ──▶  /api/cron/ingest  ──service role──▶  Supabase (Postgres)
                          discover + scrape                    threads / posts /
                          with backoff                         post_techs / thread_tech_counts
                                                                       │
                                                       anon (read-only, RLS) │
                                                                       ▼
                                       Next.js pages on Vercel  ◀──  bars · posts · trend chart
```

## Features

- **Per-thread breakdown** — ranked bars of the languages and frameworks in any
  month, split by category, featured techs highlighted.
- **Click-to-load posts** — click a bar to read the actual job posts that
  mention that tech, with a link to each HN comment.
- **Trend explorer** — pick any set of techs and a range (6mo / 1yr / 2yr / all
  / custom) to see each one's share of posts over time, as a hand-rolled SVG
  chart.

## Stack

- **Next.js** (App Router) + TypeScript, deployed on **Vercel**. The main views
  are static/ISR so traffic spikes are cheap.
- **Supabase** (Postgres) for storage, via `@supabase/supabase-js`. Row-level
  security: public read on the aggregate tables, no anon access to PII.
- **Tailwind** for resets; the dark editorial theme is hand-written CSS.
  Fonts: Fraunces + IBM Plex Mono via `next/font`.

## Methodology

- **Post-level counts**: a technology scores once per top-level job post that
  mentions it, not once per raw occurrence — mirroring hntrends.com and keeping
  one verbose listing from skewing totals. `pct` = matching posts / total posts.
- Matching is case-insensitive on word boundaries. `Java` (`\bjava\b`) never
  matches "javascript"; JavaScript counts the literal word, not "JS".
- A few labels (**Go, C, Spring, Express, Phoenix**) collide with ordinary
  English words and are flagged `≈` as upper bounds — surfaced, never dropped.
- Raw post bodies are stored, so the taxonomy can change and matching can be
  re-run without re-scraping.

## Data model

`threads` (one per month) → `posts` (top-level job listings) → `post_techs`
(M2M) → `thread_tech_counts` (the small table the charts read). The full schema,
RLS policies, taxonomy seed, and the decaying re-scrape function live in
[`supabase/schema.sql`](supabase/schema.sql).

The scraper re-visits each thread on a decaying cadence — frequently on release
day, tapering to daily, then frozen after ~35 days (HN stops accepting comments
after ~2 weeks). The cadence is enforced in SQL (`threads_due_for_scrape()`),
not the route.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase values
npm run dev
```

Environment variables (see `.env.example`):

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser reads | safe to expose |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | cron route | **server only** — never expose |
| `CRON_SECRET` | cron route | Vercel sends it as a Bearer token on cron hits |

## Deploy

1. Run `supabase/schema.sql` against your Supabase project.
2. Set the env vars above in the Vercel project.
3. Deploy. `vercel.json` registers the `*/30` ingest cron automatically.
4. Backfill history (repeat until it reports `scraped: 0`):
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://YOUR_APP.vercel.app/api/cron/ingest?mode=backfill&limit=20"
   ```

> The `*/30` cron cadence and the 300s ingest function require the Vercel **Pro**
> plan. On Hobby, switch `vercel.json` to a daily schedule.

## Credits

Built lovingly by [Adam Freemer](https://adamfreemer.com) & Claude. Data from the
public Hacker News Search API (Algolia).
