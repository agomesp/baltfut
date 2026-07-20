-- Durable archive of the ESPN data the app renders.
--
-- `match_results` already keeps the SCORES safe (so a palpite's win can't be
-- erased), but it stores only `match_id → 2-1`. The match_id is an opaque ESPN
-- event id, so nothing in this database says that id was "Espanha 2×1 Argentina,
-- Final, 19 Jul 2026". Everything the UI actually renders — team names, crests,
-- kickoff, venue, stage, scorers, cards, group tables, lineups — is refetched
-- from ESPN on every page load. ESPN is keyless, unofficial and free to drop
-- those ids whenever it likes; the day it does, the tournament becomes
-- unreadable even though we still own every palpite.
--
-- These tables store ESPN's RAW payloads rather than a re-parsed shape. The app
-- already owns a zod-validated parser (src/lib/espn/parse.ts) and that stays the
-- single source of truth: archived bytes are fed back through the SAME parser, so
-- an archived match can never drift from a live one. Re-parsing snapshot-side
-- would fork that logic, and a drifting archive is corruption you discover years
-- later. Raw also keeps fields we don't parse today but might want tomorrow.
--
-- Security mirrors match_results/promos: anon read-only, writes only through a
-- SECURITY DEFINER RPC executable by service_role. Nothing here is personal data
-- — it is a public scoreboard — so public read is intentional.

-- ---------------------------------------------------------------------------
-- Matches — one row per ESPN event (the scoreboard's `events[]` entry)
-- ---------------------------------------------------------------------------
create table public.espn_matches (
  match_id   text primary key,
  league     text        not null,
  -- Denormalised for ordering/filtering without opening the blob. Only shallow,
  -- stable fields are lifted out; anything structural stays in `raw`.
  starts_at  timestamptz,
  state      text,
  raw        jsonb       not null,
  updated_at timestamptz not null default now()
);
create index espn_matches_league_starts_idx on public.espn_matches (league, starts_at);

alter table public.espn_matches enable row level security;
alter table public.espn_matches force row level security;

-- Grants gotcha: a new table gets ZERO grants on this project — grant both.
revoke all on public.espn_matches from anon, authenticated;
grant select on public.espn_matches to anon, authenticated;
grant select, insert, update, delete on public.espn_matches to service_role;

create policy "Public can read espn_matches"
  on public.espn_matches for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Standings — the group tables, one row per league
-- ---------------------------------------------------------------------------
create table public.espn_standings (
  league     text primary key,
  raw        jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.espn_standings enable row level security;
alter table public.espn_standings force row level security;

revoke all on public.espn_standings from anon, authenticated;
grant select on public.espn_standings to anon, authenticated;
grant select, insert, update, delete on public.espn_standings to service_role;

create policy "Public can read espn_standings"
  on public.espn_standings for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Summaries — the per-match detail endpoint (lineups, subs, and more)
-- ---------------------------------------------------------------------------
create table public.espn_summaries (
  match_id   text primary key,
  league     text        not null,
  raw        jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.espn_summaries enable row level security;
alter table public.espn_summaries force row level security;

revoke all on public.espn_summaries from anon, authenticated;
grant select on public.espn_summaries to anon, authenticated;
grant select, insert, update, delete on public.espn_summaries to service_role;

create policy "Public can read espn_summaries"
  on public.espn_summaries for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Writers. Self-correcting upserts: a later ESPN correction (a disallowed goal,
-- a re-dated fixture) overwrites the row on the next run.
-- ---------------------------------------------------------------------------
create or replace function public.set_espn_matches(items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  insert into public.espn_matches (match_id, league, starts_at, state, raw, updated_at)
  select x.match_id, x.league, x.starts_at, x.state, x.raw, now()
  from jsonb_to_recordset(items) as x(
    match_id text, league text, starts_at timestamptz, state text, raw jsonb
  )
  on conflict (match_id) do update set
    league     = excluded.league,
    starts_at  = excluded.starts_at,
    state      = excluded.state,
    raw        = excluded.raw,
    updated_at = now();
end;
$func$;
revoke all on function public.set_espn_matches(jsonb) from public, anon, authenticated;
grant execute on function public.set_espn_matches(jsonb) to service_role;

create or replace function public.set_espn_standings(p_league text, p_raw jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  insert into public.espn_standings (league, raw, updated_at)
  values (p_league, p_raw, now())
  on conflict (league) do update set
    raw        = excluded.raw,
    updated_at = now();
end;
$func$;
revoke all on function public.set_espn_standings(text, jsonb) from public, anon, authenticated;
grant execute on function public.set_espn_standings(text, jsonb) to service_role;

create or replace function public.set_espn_summaries(items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  insert into public.espn_summaries (match_id, league, raw, updated_at)
  select x.match_id, x.league, x.raw, now()
  from jsonb_to_recordset(items) as x(match_id text, league text, raw jsonb)
  on conflict (match_id) do update set
    league     = excluded.league,
    raw        = excluded.raw,
    updated_at = now();
end;
$func$;
revoke all on function public.set_espn_summaries(jsonb) from public, anon, authenticated;
grant execute on function public.set_espn_summaries(jsonb) to service_role;
