-- ============================================================================
-- name_claims: one row per claimed nickname, so a name belongs to the person who
-- first used it (proved by a secret token kept in their browser's localStorage).
-- Another person cannot palpite under that name while the claim is fresh; after
-- 24h with no palpite the claim goes stale and the name can be re-claimed.
--
-- SECURITY: only the cast-vote Edge Function (service_role) touches this table.
-- token_hash is a salted SHA-256 of the owner's token and is NEVER exposed to
-- anon (anon has zero grants here). Managed entirely server-side.
-- ============================================================================
create table public.name_claims (
  name_lower   text        primary key,
  name         text        not null,
  -- Salted SHA-256 of the owner's localStorage token (server-side). Secret.
  token_hash   text        not null,
  last_used_at timestamptz not null default now(),

  constraint name_claims_name_lower_len_chk check (char_length(name_lower) between 2 and 24),
  constraint name_claims_name_len_chk       check (char_length(name) between 2 and 24),
  constraint name_claims_token_hash_len_chk check (char_length(token_hash) between 16 and 128)
);

comment on table public.name_claims is
  'Nickname ownership. token_hash = salted SHA-256 of the owner localStorage token; never granted to anon. Managed only by the cast-vote function (service_role).';

alter table public.name_claims enable row level security;
-- FORCE so even the owner obeys RLS; service_role bypasses via BYPASSRLS.
alter table public.name_claims force row level security;

-- No anon/authenticated access at all — the secret token_hash must never leak,
-- and only the Edge Function may read/write claims.
revoke all on public.name_claims from anon, authenticated;

-- service_role has BYPASSRLS but still needs an explicit table GRANT (this project
-- has "Automatically expose new tables" OFF — a new table gets ZERO grants).
grant select, insert, update on public.name_claims to service_role;
