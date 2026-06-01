# CLAUDE.md

Persistent context for Claude Code. Read this first, then `docs/BUILD_PLAN.md`
for the phased build, and treat `reference/prototype.html` as the visual + logic
source of truth for the UI.

## What this is

A web app that analyzes the monthly Hacker News "Ask HN: Who is hiring?" threads.
It scrapes the threads on a schedule, stores normalized data in Supabase, and
serves a Next.js frontend that reads **pre-aggregated** counts (the browser never
calls the HN API). Features: a thread-by-thread breakdown of which languages and
frameworks appear most, a configurable trend chart over time, click-to-load of
the actual job posts, and an optional email digest.

## Stack

- Next.js (App Router) + TypeScript, deployed on **Vercel Pro** (Pro matters:
  it allows sub-daily cron and 300s functions; Hobby caps cron at once/day).
- Supabase (Postgres) for storage; `@supabase/supabase-js` v2.
- Tailwind for styling. Charts are hand-rolled inline SVG (no chart lib needed).
- Email (optional, v1.1): Resend.

## Repo map

```
supabase/schema.sql                  # tables, indexes, RLS, taxonomy seed, due-fn, subscribers
web/lib/techs.ts                     # matching dictionary + HTML/parse helpers (PROVIDED, done)
web/lib/queries.ts                   # browser read queries against aggregate tables (PROVIDED, done)
web/app/api/cron/ingest/route.ts     # the scraper (PROVIDED, done)
web/vercel.json                      # cron schedule (PROVIDED)
web/.env.example                     # env var template (PROVIDED)
reference/prototype.html             # WORKING single-file prototype — the design + logic to port
reference/theme.css                  # extracted design tokens
reference/data-notes.md              # durable facts + methodology (don't lose these)
docs/BUILD_PLAN.md                   # phased build instructions — follow this
```

Files marked PROVIDED are complete and correct; wire them in, don't rewrite them
unless the plan says so.

## Hard rules (do not violate)

- **No signup gate.** The page is fully usable with zero account. The email
  digest is an opt-in feature offered after value is shown, never a wall.
- **Service-role key is server-only.** Never import it into a client component,
  never prefix it with `NEXT_PUBLIC_`. Only the cron + subscribe routes use it.
- **`subscribers` is PII.** No anon access; reads/writes only via service-role
  server routes. Public read policies exist only on the aggregate/public tables.
- **The browser never scrapes Algolia.** All HN fetching happens in the ingest
  route. The frontend reads Supabase only.
- **Counts are post-level**: a tech scores once per top-level job post that
  mentions it, not per raw occurrence. Don't "fix" this into occurrence counts.
- **Scrape cadence lives in SQL** (`threads_due_for_scrape()`), not in the route.
- Approximate techs (`go`, `c`, `spring`, `express`, `phoenix`) collide with
  common words; surface them with the `approx` flag, never silently drop them.

## Conventions

- TypeScript strict. Prefer Server Components for reads; Client Components only
  where interaction needs it (toggles, checkboxes, click-to-load).
- Render the main views with ISR/static caching so a HN front-page spike is
  cheap (the data changes a few times a day at most).
- Keep secrets in env. `.env.local` for dev (gitignored), Vercel project env for
  prod.
