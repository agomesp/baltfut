-- Bracket palpites: one saved knockout prediction per nickname. Each correct
-- winner is worth 0.2 in the SAME Ranking dos Subs as the score palpites, so a
-- user's bracket picks are stored under the same username and folded into their
-- ranking total. Mirrors the votes security model exactly:
--   * WRITES: only the cast-bracket Edge Function (service_role). anon has no
--     insert/update/delete — RLS enabled + forced, no write policy.
--   * READS: anon may read the public columns only (username, picks, updated_at).
--     `ip_hash` and `id` are never granted to anon.
create table public.bracket_palpites (
  id          uuid        primary key default gen_random_uuid(),
  username    text        not null,
  picks       jsonb       not null,
  ip_hash     text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint bracket_palpites_username_uniq  unique (username),
  constraint bracket_palpites_ip_hash_len_chk check (char_length(ip_hash) between 16 and 128),
  constraint bracket_palpites_picks_obj_chk   check (jsonb_typeof(picks) = 'object'),
  constraint bracket_palpites_picks_size_chk  check (char_length(picks::text) < 4000)
);

comment on table public.bracket_palpites is
  'One saved knockout bracket per nickname. Writes only via the cast-bracket Edge Function (service_role). anon may read public columns; ip_hash is never exposed to anon.';
comment on column public.bracket_palpites.ip_hash is
  'Salted SHA-256 of the client IP (server-side). Never granted to anon.';

alter table public.bracket_palpites enable row level security;
alter table public.bracket_palpites force row level security;

-- Grants gotcha: a NEW table gets ZERO grants on this project — grant both roles.
-- Start from zero, then grant ONLY the safe, public columns (no id, no ip_hash)
-- and no INSERT/UPDATE/DELETE to anon.
revoke all on public.bracket_palpites from anon, authenticated;
grant select (username, picks, updated_at)
  on public.bracket_palpites to anon, authenticated;
grant select, insert, update, delete on public.bracket_palpites to service_role;

-- Reads are public; writes have no policy at all, so anon/authenticated can never
-- insert/update/delete.
create policy "Public can read bracket_palpites"
  on public.bracket_palpites
  for select
  to anon, authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- Public bracket feed (security_invoker = true: runs as the caller, honoring RLS
-- + the column grants above — so it can NEVER surface ip_hash or id).
-- ----------------------------------------------------------------------------
create view public.bracket_entries
  with (security_invoker = true)
as
  select
    username,
    picks,
    updated_at
  from public.bracket_palpites
  order by updated_at desc;

comment on view public.bracket_entries is
  'Public per-nickname bracket feed (no id, no ip_hash). Newest first.';

grant select on public.bracket_entries to anon, authenticated;
