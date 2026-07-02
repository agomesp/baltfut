-- Durable snapshot of every finished match's final score. The Ranking dos Subs
-- grades palpites against ESPN's LIVE scoreboard; if ESPN ever drops an old match
-- or has an outage, those results (and the wins on them) vanish. This table keeps
-- a permanent copy: a cron (results-pull.mjs → set_match_results) upserts finished
-- matches, and the page reads it (anon) and prefers it over ESPN for grading.
-- Mirrors the promos/votes security model: anon read-only; writes only via
-- service_role through a SECURITY DEFINER RPC.
create table public.match_results (
  match_id      text primary key,
  league        text not null,
  home_score    int  not null,
  away_score    int  not null,
  home_shootout int,
  away_shootout int,
  updated_at    timestamptz not null default now()
);

alter table public.match_results enable row level security;
alter table public.match_results force row level security;

-- Grants gotcha: a new table gets ZERO grants on this project — grant both.
revoke all on public.match_results from anon, authenticated;
grant select on public.match_results to anon, authenticated;              -- public read
grant select, insert, update, delete on public.match_results to service_role;

create policy "Public can read match_results"
  on public.match_results for select to anon, authenticated using (true);

-- Upsert finished results (self-correcting: a later ESPN correction updates the
-- row on the next cron run). Only service_role may execute it; anon cannot.
create or replace function public.set_match_results(items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  insert into public.match_results (match_id, league, home_score, away_score, home_shootout, away_shootout, updated_at)
  select x.match_id, x.league, x.home_score, x.away_score, x.home_shootout, x.away_shootout, now()
  from jsonb_to_recordset(items) as x(
    match_id text, league text, home_score int, away_score int, home_shootout int, away_shootout int
  )
  on conflict (match_id) do update set
    league        = excluded.league,
    home_score    = excluded.home_score,
    away_score    = excluded.away_score,
    home_shootout = excluded.home_shootout,
    away_shootout = excluded.away_shootout,
    updated_at    = now();
end;
$func$;
revoke all on function public.set_match_results(jsonb) from public, anon, authenticated;
grant execute on function public.set_match_results(jsonb) to service_role;
