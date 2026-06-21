-- ============================================================================
-- votes: community SCORE PREDICTIONS for soccer matches.
--
-- A prediction is just (username, predicted home score, predicted away score)
-- for a match. The live "winning / can win / losing" ranking is derived on the
-- client from each prediction vs the match's current score — nothing about that
-- is stored here.
--
-- SECURITY MODEL (secure-first, no end-user auth)
--   * Only `anon` (the static site) and `service_role` (the cast-vote Edge
--     Function) reach this table.
--   * WRITES: anon has NO insert/update/delete. Votes are inserted ONLY by the
--     Edge Function (service_role), after it validates the payload and derives a
--     salted hash of the real client IP server-side. That is what makes one
--     vote per IP per match enforceable from a static page.
--   * READS: anon may read the public columns only. `ip_hash` is never granted
--     to anon, so it can never leave the database.
--   * CHECK constraints mirror the app/function validation as a DB backstop.
-- ============================================================================

create table public.votes (
  id          uuid primary key default gen_random_uuid(),
  match_id    text        not null,
  league      text        not null,
  username    text        not null,
  pred_home   smallint    not null,
  pred_away   smallint    not null,
  -- Salted SHA-256 of the client IP, computed server-side by the Edge Function.
  -- The raw IP is never stored. Used solely to enforce one vote per IP / match.
  ip_hash     text        not null,
  created_at  timestamptz not null default now(),

  constraint votes_match_id_fmt_chk  check (match_id ~ '^[A-Za-z0-9_-]+$' and char_length(match_id) between 1 and 64),
  constraint votes_league_fmt_chk    check (league ~ '^[A-Za-z0-9.-]+$' and char_length(league) between 1 and 32),
  constraint votes_username_len_chk  check (char_length(username) between 2 and 24),
  -- Backstop only (the Edge Function enforces the precise unicode charset):
  -- block control chars and angle brackets so nothing markup-like is stored.
  constraint votes_username_safe_chk check (username !~ '[[:cntrl:]]' and username !~ '[<>]'),
  constraint votes_pred_home_chk     check (pred_home between 0 and 30),
  constraint votes_pred_away_chk     check (pred_away between 0 and 30),
  constraint votes_ip_hash_len_chk   check (char_length(ip_hash) between 16 and 128),

  -- One prediction per IP per match: a refresh-and-resubmit hits this constraint.
  constraint votes_one_per_ip_per_match unique (match_id, ip_hash)
);

comment on table public.votes is
  'Anonymous community score predictions. Writes only via the cast-vote Edge Function (service_role). anon may read public columns; ip_hash is never exposed to anon.';
comment on column public.votes.ip_hash is
  'Salted SHA-256 of the client IP (server-side). Never granted to anon. Enables one-vote-per-IP-per-match without storing the raw IP.';

-- Fast lookups for the per-match predictions feed.
create index votes_match_created_idx on public.votes (match_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.votes enable row level security;
-- FORCE so even the table owner obeys RLS; service_role bypasses via BYPASSRLS.
alter table public.votes force row level security;

-- Start from zero, then grant ONLY the safe, public columns. Note the deliberate
-- absence of id, ip_hash, and of any INSERT/UPDATE/DELETE grant.
revoke all on public.votes from anon, authenticated;
grant select (match_id, league, username, pred_home, pred_away, created_at)
  on public.votes to anon, authenticated;

-- RLS still has to permit the rows. Reads are public; writes have no policy at
-- all, so anon/authenticated can never insert/update/delete.
create policy "Public can read votes"
  on public.votes
  for select
  to anon, authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- Public predictions feed (security_invoker = true: runs as the caller, honoring
-- RLS + the column grants above — so it can NEVER surface ip_hash). Newest first.
-- ----------------------------------------------------------------------------
create view public.vote_entries
  with (security_invoker = true)
as
  select
    match_id,
    league,
    username,
    pred_home,
    pred_away,
    created_at
  from public.votes
  order by created_at desc;

comment on view public.vote_entries is
  'Public per-prediction feed (no id, no ip_hash). Newest first.';

grant select on public.vote_entries to anon, authenticated;
