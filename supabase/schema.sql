-- ============================================================================
-- HN "Who is hiring?" analytics — Supabase / Postgres schema
-- Run in the Supabase SQL editor (or as a migration).
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Taxonomy. The regex matching logic lives in the edge function (versioned in
-- code); this table exists for FK integrity, the frontend legend, and so you
-- can recolor / relabel without a redeploy. `approx = true` flags labels that
-- collide with ordinary English words (Go, C, Spring, Express, Phoenix).
-- ---------------------------------------------------------------------------
create table if not exists techs (
  slug      text primary key,
  name      text not null,
  category  text not null check (category in ('language','framework')),
  color     text,
  approx    boolean not null default false,
  featured  boolean not null default false
);

-- ---------------------------------------------------------------------------
-- One row per monthly "Who is hiring?" thread.
--   id          = HN story id
--   month       = first day of the posting month (for ordering / range queries)
--   post_count  = OUR parsed top-level job posts (num_comments includes replies)
-- Scrape bookkeeping drives the decaying re-scrape schedule.
-- ---------------------------------------------------------------------------
create table if not exists threads (
  id               bigint primary key,
  month            date not null,
  title            text not null,
  posted_at        timestamptz not null,
  hn_points        int  not null default 0,
  num_comments     int  not null default 0,
  post_count       int  not null default 0,
  first_scraped_at timestamptz,
  last_scraped_at  timestamptz,
  scrape_count     int  not null default 0,
  is_archived      boolean not null default false
);
create index if not exists threads_month_idx on threads (month);

-- ---------------------------------------------------------------------------
-- Top-level job posts. Raw body is kept so matching can be re-run later if the
-- taxonomy changes (just reprocess; no re-scrape needed).
-- ---------------------------------------------------------------------------
create table if not exists posts (
  id              bigint primary key,        -- HN comment id
  thread_id       bigint not null references threads(id) on delete cascade,
  author          text,
  title           text,                      -- first non-empty line
  body            text not null,             -- HTML-stripped plain text
  posted_at       timestamptz,
  is_remote       boolean,
  location        text,
  salary_min      int,
  salary_max      int,
  salary_currency text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists posts_thread_idx on posts (thread_id);

-- post <-> tech (many-to-many). Powers "show me the posts mentioning Django".
create table if not exists post_techs (
  post_id   bigint not null references posts(id) on delete cascade,
  tech_slug text   not null references techs(slug) on delete cascade,
  primary key (post_id, tech_slug)
);
create index if not exists post_techs_tech_idx on post_techs (tech_slug);

-- ---------------------------------------------------------------------------
-- Pre-aggregated counts. THIS is what the frontend reads for bars + trend:
-- tiny, indexed, no scanning of post bodies in the browser.
-- ---------------------------------------------------------------------------
create table if not exists thread_tech_counts (
  thread_id  bigint not null references threads(id) on delete cascade,
  tech_slug  text   not null references techs(slug) on delete cascade,
  post_count int    not null default 0,
  pct        numeric(5,2) not null default 0,
  primary key (thread_id, tech_slug)
);
create index if not exists ttc_tech_idx on thread_tech_counts (tech_slug);

-- ---------------------------------------------------------------------------
-- Decaying re-scrape schedule. The cron fires often (say every 30 min) but the
-- function only actually scrapes threads this returns. Age tiers:
--   < 48h   : every ~2h  (release day + next couple days, the fill window)
--   < 14d   : every ~12h (HN still accepts comments for ~2 weeks)
--   < 35d   : daily      (stragglers / edits)
--   >= 35d  : archived, never scraped again (thread is frozen)
-- ---------------------------------------------------------------------------
create or replace function threads_due_for_scrape()
returns setof threads
language sql stable as $$
  select * from threads t
  where not t.is_archived
    and (
         t.last_scraped_at is null
      or (now() - t.posted_at <  interval '48 hours' and now() - t.last_scraped_at > interval '2 hours')
      or (now() - t.posted_at <  interval '14 days'  and now() - t.last_scraped_at > interval '12 hours')
      or (now() - t.posted_at <  interval '35 days'  and now() - t.last_scraped_at > interval '24 hours')
    )
  order by t.posted_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: everything here is public HN data, so anon gets SELECT
-- only. All writes go through the edge function using the service-role key,
-- which bypasses RLS. No write policies for anon == no anon writes.
-- ---------------------------------------------------------------------------
alter table techs              enable row level security;
alter table threads            enable row level security;
alter table posts              enable row level security;
alter table post_techs         enable row level security;
alter table thread_tech_counts enable row level security;

create policy "public read techs"   on techs              for select using (true);
create policy "public read threads" on threads            for select using (true);
create policy "public read posts"   on posts              for select using (true);
create policy "public read pt"      on post_techs         for select using (true);
create policy "public read ttc"     on thread_tech_counts for select using (true);

-- ---------------------------------------------------------------------------
-- Seed the taxonomy. Colors are golden-angle HSL for good separation on a dark
-- chart; tweak freely.
-- ---------------------------------------------------------------------------
insert into techs (slug, name, category, approx, featured, color) values
  ('python','Python','language',false,true,'hsl(18 60% 62%)'),
  ('javascript','JavaScript','language',false,true,'hsl(156 60% 62%)'),
  ('java','Java','language',false,true,'hsl(293 60% 62%)'),
  ('ruby','Ruby','language',false,true,'hsl(70 60% 62%)'),
  ('typescript','TypeScript','language',false,false,'hsl(208 60% 62%)'),
  ('go','Go','language',true,false,'hsl(345 60% 62%)'),
  ('rust','Rust','language',false,false,'hsl(122 60% 62%)'),
  ('cpp','C++','language',false,false,'hsl(259 60% 62%)'),
  ('csharp','C#','language',false,false,'hsl(36 60% 62%)'),
  ('php','PHP','language',false,false,'hsl(173 60% 62%)'),
  ('swift','Swift','language',false,false,'hsl(311 60% 62%)'),
  ('kotlin','Kotlin','language',false,false,'hsl(88 60% 62%)'),
  ('scala','Scala','language',false,false,'hsl(226 60% 62%)'),
  ('elixir','Elixir','language',false,false,'hsl(3 60% 62%)'),
  ('clojure','Clojure','language',false,false,'hsl(140 60% 62%)'),
  ('haskell','Haskell','language',false,false,'hsl(277 60% 62%)'),
  ('c','C','language',true,false,'hsl(54 60% 62%)'),
  ('react','React','framework',false,false,'hsl(191 60% 62%)'),
  ('rails','Rails','framework',false,true,'hsl(329 60% 62%)'),
  ('django','Django','framework',false,true,'hsl(106 60% 62%)'),
  ('nodejs','Node.js','framework',false,false,'hsl(244 60% 62%)'),
  ('nextjs','Next.js','framework',false,false,'hsl(21 60% 62%)'),
  ('vue','Vue','framework',false,false,'hsl(159 60% 62%)'),
  ('angular','Angular','framework',false,false,'hsl(296 60% 62%)'),
  ('svelte','Svelte','framework',false,false,'hsl(73 60% 62%)'),
  ('dotnet','.NET','framework',false,false,'hsl(211 60% 62%)'),
  ('spring','Spring','framework',true,false,'hsl(348 60% 62%)'),
  ('flask','Flask','framework',false,false,'hsl(125 60% 62%)'),
  ('fastapi','FastAPI','framework',false,false,'hsl(262 60% 62%)'),
  ('laravel','Laravel','framework',false,false,'hsl(39 60% 62%)'),
  ('express','Express','framework',true,false,'hsl(176 60% 62%)'),
  ('phoenix','Phoenix','framework',true,false,'hsl(314 60% 62%)')
on conflict (slug) do update
  set name=excluded.name, category=excluded.category,
      approx=excluded.approx, featured=excluded.featured, color=excluded.color;

-- ---------------------------------------------------------------------------
-- Email digest subscribers (the optional, value-first capture — NOT a gate).
-- PII, so anon gets NO access: the public subscribe form posts to a server
-- route that writes with the service-role key. Double opt-in via confirm_token.
-- ---------------------------------------------------------------------------
create table if not exists subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  filters         jsonb not null default '{}'::jsonb,  -- {techs:[], remote:bool, query:""}
  confirmed       boolean not null default false,
  confirm_token   uuid not null default gen_random_uuid(),
  unsub_token     uuid not null default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz
);
create unique index if not exists subscribers_email_idx on subscribers (lower(email));

alter table subscribers enable row level security;
-- intentionally NO policies for anon: all access is via service role only.
