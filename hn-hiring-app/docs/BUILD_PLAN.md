# Build plan

Execute in order. Each phase has acceptance criteria; don't move on until they
pass. The provided files (`web/lib/*`, the ingest route, `vercel.json`,
`schema.sql`) are done and correct, wire them in rather than rewriting.

The UI source of truth is `reference/prototype.html`: a complete, working
single-file version with the exact design (dark editorial theme, Fraunces +
IBM Plex Mono, HN-orange accent), the bar chart, the trend explorer (checkbox
tech picker + 6m/1y/2y/all/custom range), and click-to-load posts. Port its
look and behavior; the only real change is that data comes from Supabase via
`web/lib/queries.ts` instead of live Algolia calls.

---

## Phase 0 — Prerequisites

- Supabase project (free tier is fine to start).
- Vercel account on the **Pro** plan (required for the cron cadence).
- Optional, deferrable to Phase 6: a Resend account + API key for email.

Acceptance: you have the Supabase URL, anon key, and service-role key.

---

## Phase 1 — Scaffold

1. `npx create-next-app@latest web` with: App Router, TypeScript, Tailwind, ESLint,
   `src/` dir = no, import alias `@/*` = yes. (If `web/` already exists with the
   provided files, scaffold in a temp dir and merge, preserving the provided files.)
2. `cd web && npm i @supabase/supabase-js`.
3. Ensure the provided files sit at:
   `web/lib/techs.ts`, `web/lib/queries.ts`,
   `web/app/api/cron/ingest/route.ts`, `web/vercel.json`.
4. Copy `.env.example` to `.env.local` and fill it in.

Acceptance: `npm run dev` boots; `npm run build` compiles with the provided
files present.

---

## Phase 2 — Database

1. In the Supabase SQL editor, run `supabase/schema.sql` in full.
2. Confirm tables exist: `techs` (seeded ~32 rows), `threads`, `posts`,
   `post_techs`, `thread_tech_counts`, `subscribers`.
3. Confirm RLS is ON for all, with public SELECT only on `techs`, `threads`,
   `posts`, `post_techs`, `thread_tech_counts`, and NO anon policies on
   `subscribers`.

Acceptance: `select * from techs` returns the seed; anon cannot select
`subscribers`.

---

## Phase 3 — Ingestion + backfill

1. Set the server env vars in Vercel (and `.env.local`): `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (generate: `openssl rand -hex 32`).
2. Deploy to Vercel. `vercel.json` registers the `*/30 * * * *` cron automatically.
3. Backfill history (repeat until it reports `scraped: 0`):
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://YOUR_APP.vercel.app/api/cron/ingest?mode=backfill&limit=50"
   ```
4. Verify: `threads` has ~180+ rows; the latest thread has a few hundred `posts`;
   `thread_tech_counts` is populated.

Acceptance: aggregate tables are full; a tick run (`?mode=tick`) scrapes only
the current thread per the age tiers.

Note on the schedule: the cron fires every 30 min but `threads_due_for_scrape()`
gates the work — the current thread is scraped ~every 2h for its first 48h,
~twice daily through 14 days, daily through 35 days, then archived (frozen).

---

## Phase 4 — Read layer

`web/lib/queries.ts` is provided and exposes: `getOverview`, `getThreads`,
`getThreadCounts(threadId, category?)`, `getTrend(slugs, fromMonth, toMonth?)`,
`getPostsForTech(threadId, slug, limit, offset)`. Use these; do not query HN.

Add a browser Supabase client (anon key) — `queries.ts` already creates one from
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Acceptance: a throwaway page can render the overview stats and the latest
thread's counts from Supabase.

---

## Phase 5 — UI (port the prototype)

Rebuild `reference/prototype.html` as React components, same design, data from
Supabase. Pull design tokens from `reference/theme.css` into `globals.css` /
Tailwind theme. Load Fraunces + IBM Plex Mono via `next/font`.

Components (suggested):
- `StatRow` — total threads, first month, latest month, span. Source: `getOverview`.
- `ThreadPicker` — dropdown of months. Source: `getThreads`. Default: latest.
- `CategoryToggle` — Languages | Frameworks.
- `Bars` — ranked horizontal bars for the selected thread + category, featured
  techs highlighted, `approx` techs flagged with `≈`. Source: `getThreadCounts`.
  Each bar is clickable.
- `PostsPanel` — on bar click, show first 10 matching posts (title = first line,
  snippet, author, link to the HN comment), plus "open all in a new tab" (render
  a standalone list) and "show all here". Source: `getPostsForTech` (paginated).
- `TrendExplorer` — checkbox picker of all techs (colored swatches from the
  `techs` table), range toggle (6m / 1y / 2y / all / custom with from→to month
  selects), and a hand-rolled SVG multi-line chart of each selected tech's
  `pct` over months. Source: `getTrend`. Toggling checkboxes redraws with no
  refetch; changing range refetches.
- `EmailCapture` — see Phase 6.

Rendering: make the main page static/ISR (e.g. `revalidate` ~1800s) so spikes
are cheap; interactive pieces are Client Components fed by the cached server data
or light client fetches.

Acceptance: visual + behavioral parity with the prototype, served from Supabase,
fast on repeat loads.

---

## Phase 6 — Email digest (optional, v1.1)

The `subscribers` table is already in the schema. Build, all server-side with the
service-role key:
- `EmailCapture` component: a single email field + the current filter config
  (techs, remote, query). No password, no account. Posts to `/api/subscribe`.
- `POST /api/subscribe` — insert `{email, filters, confirmed:false}`, send a
  confirmation email (Resend) linking to `/api/confirm?token=...`. Double opt-in.
- `GET /api/confirm` — set `confirmed=true`, `confirmed_at=now()`.
- `GET /api/unsubscribe` — set `unsubscribed_at=now()` via `unsub_token`. Include
  this link in every email (CAN-SPAM / GDPR).
- `GET /api/cron/digest` — monthly cron (add to `vercel.json`, e.g. a few hours
  after the 1st-of-month thread lands). For each confirmed subscriber, query the
  latest thread's posts matching their filters and email them. Guard with
  `CRON_SECRET` like the ingest route. Env: `RESEND_API_KEY`.

Keep this behind the env var so the app runs fine without email configured.

Acceptance: subscribe → confirm → receive a test digest → unsubscribe, all work;
the list is never readable by anon.

---

## Phase 7 — Polish

- OG image + meta for the Show HN.
- Loading skeletons and a clear error state if Supabase is unreachable.
- Basic a11y: keyboard-focusable bars/checkboxes, labels, contrast.
- A short "/about" or footer explaining the methodology (post-level counts,
  approx techs, data source). Pull copy from `reference/data-notes.md`.

---

## Out of scope for v1 (do not build)

- User accounts / passwords / auth. The email list needs none of it.
- Any paywall or subscription billing.
- Browser-side scraping of HN.
- Recruiter/employer-side features.
