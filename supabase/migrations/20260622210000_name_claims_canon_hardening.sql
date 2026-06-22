-- Homoglyph hardening: store a confusable "skeleton" of each claimed nickname so
-- visual look-alikes ("Rodrigo BaItar" with a capital-I vs "Rodrigo Baltar")
-- resolve to the same identity and can't be used to impersonate an existing
-- owner. The cast-vote function writes name_canon = nameSkeleton(username) and
-- rejects a vote whose skeleton is owned by a different, still-fresh token
-- (see supabase/functions/_shared/name-normalize.ts).
alter table public.name_claims add column if not exists name_canon text;

-- Backfill existing rows with a separator-stripped lower-case key. For clean
-- ASCII names this equals the TS nameSkeleton output (the confusable/diacritic
-- folding only matters for new adversarial input), so existing owners keep being
-- recognized without a rewrite. Non-unique on purpose: the backfill must never
-- collide, and ownership is decided in the function, not by a DB constraint.
update public.name_claims
set name_canon = regexp_replace(name_lower, '[[:space:]._-]+', '', 'g')
where name_canon is null;

create index if not exists name_claims_name_canon_idx
  on public.name_claims (name_canon);

-- service_role already holds table-level grants on name_claims (it is the only
-- writer), which automatically cover the new column. anon has zero grants here,
-- so name_canon — like token_hash — is never exposed.
