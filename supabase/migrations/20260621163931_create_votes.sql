-- ============================================================================
-- votes: community predictions for live soccer matches.
--
-- SECURITY MODEL (secure-first, no end-user auth)
--   * The site is fully public and anonymous. The only Postgres roles that
--     reach this table are `anon` (the static site, via the public anon key)
--     and `service_role` (the cast-vote Edge Function, server-side only).
--   * WRITES: anon has NO insert/update/delete. Votes are inserted ONLY by the
--     Edge Function using service_role, after it validates the payload and
--     derives a salted hash of the real client IP server-side. This is what
--     makes "one vote per IP per match" enforceable — a static page cannot be
--     trusted to report its own IP.
--   * READS: anon may read the *public* columns only. `ip_hash` is never
--     granted to anon, so it can never leave the database.
--   * CHECK constraints duplicate the app/Edge-Function validation as a
--     last-line DB defense in case another writer is ever added.
-- ============================================================================

create table public.votes (
  id                  uuid primary key default gen_random_uuid(),
  match_id            text        not null,
  league              text        not null,
  username            text        not null,
  preferred_side      text        not null,
  preferred_team_abbr text        not null,
  pred_home           smallint    not null,
  pred_away           smallint    not null,
  -- Salted SHA-256 of the client IP, computed server-side by the Edge Function.
  -- The raw IP is never stored. Used solely to enforce one vote per IP / match.
  ip_hash             text        not null,
  created_at          timestamptz not null default now(),

  constraint votes_match_id_fmt_chk      check (match_id ~ '^[A-Za-z0-9_-]+$' and char_length(match_id) between 1 and 64),
  constraint votes_league_fmt_chk        check (league ~ '^[A-Za-z0-9.-]+$' and char_length(league) between 1 and 32),
  constraint votes_username_len_chk      check (char_length(username) between 2 and 24),
  -- Backstop only (the Edge Function enforces the precise unicode charset):
  -- block control chars and angle brackets so nothing markup-like is stored.
  constraint votes_username_safe_chk     check (username !~ '[[:cntrl:]]' and username !~ '[<>]'),
  constraint votes_preferred_side_chk    check (preferred_side in ('home', 'away')),
  constraint votes_abbr_fmt_chk          check (preferred_team_abbr ~ '^[A-Za-z0-9]+$' and char_length(preferred_team_abbr) between 1 and 8),
  constraint votes_pred_home_chk         check (pred_home between 0 and 30),
  constraint votes_pred_away_chk         check (pred_away between 0 and 30),
  constraint votes_ip_hash_len_chk       check (char_length(ip_hash) between 16 and 128),

  -- One vote per IP per match: a refresh-and-resubmit hits this constraint.
  constraint votes_one_per_ip_per_match  unique (match_id, ip_hash)
);

comment on table public.votes is
  'Anonymous community votes for soccer matches. Writes only via the cast-vote Edge Function (service_role). anon may read public columns; ip_hash is never exposed to anon.';
comment on column public.votes.ip_hash is
  'Salted SHA-256 of the client IP (server-side). Never granted to anon. Enables one-vote-per-IP-per-match without storing the raw IP.';

-- Fast lookups for per-match aggregates and the recent-entries feed.
create index votes_match_created_idx on public.votes (match_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.votes enable row level security;
-- FORCE so even the table owner obeys RLS; service_role bypasses via BYPASSRLS.
alter table public.votes force row level security;

-- Start from zero, then grant ONLY the safe, public columns to anon/authenticated.
-- Note the deliberate absence of ip_hash and of any INSERT/UPDATE/DELETE grant.
revoke all on public.votes from anon, authenticated;
grant select
  (match_id, league, username, preferred_side, preferred_team_abbr, pred_home, pred_away, created_at)
  on public.votes to anon, authenticated;

-- RLS still has to permit the rows themselves. Reads are public; writes have no
-- policy at all, so anon/authenticated can never insert/update/delete.
create policy "Public can read votes"
  on public.votes
  for select
  to anon, authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- Read views (security_invoker = true: run as the caller, honoring RLS + the
-- column grants above — so they can NEVER surface ip_hash). This avoids
-- SECURITY DEFINER views entirely.
-- ----------------------------------------------------------------------------

-- Aggregated results per match — the headline "what does the crowd think".
create view public.vote_results
  with (security_invoker = true)
as
  select
    match_id,
    league,
    count(*)::int                                          as total_votes,
    count(*) filter (where preferred_side = 'home')::int   as home_votes,
    count(*) filter (where preferred_side = 'away')::int   as away_votes,
    round(avg(pred_home)::numeric, 2)                      as avg_pred_home,
    round(avg(pred_away)::numeric, 2)                      as avg_pred_away,
    max(created_at)                                        as last_vote_at
  from public.votes
  group by match_id, league;

comment on view public.vote_results is
  'Per-match vote aggregates for public display. Reads via the caller''s grants; ip_hash is not selectable.';

grant select on public.vote_results to anon, authenticated;

-- Individual entries to show "people who voted" — public columns only, newest first.
create view public.vote_entries
  with (security_invoker = true)
as
  select
    match_id,
    league,
    username,
    preferred_side,
    preferred_team_abbr,
    pred_home,
    pred_away,
    created_at
  from public.votes
  order by created_at desc;

comment on view public.vote_entries is
  'Public per-vote feed (no ip_hash, no id). Newest first.';

grant select on public.vote_entries to anon, authenticated;
