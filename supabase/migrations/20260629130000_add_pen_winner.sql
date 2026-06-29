-- Add an optional penalty-shootout winner to a prediction. On a knockout tie a
-- sub may also call who wins the shootout (home/away, no score). Nullable: group
-- palpites and every pre-feature row have none. A correct call scores 0.5 in the
-- ranking (computed client-side); this column just stores the pick.
--
-- SECURITY (same model as the rest of `votes`):
--   * Written ONLY by the cast-vote Edge Function (service_role — which already
--     holds insert+update on votes; no new service_role grant needed).
--   * anon/authenticated get a column-level SELECT so the public `vote_entries`
--     view (security_invoker) can surface it. ip_hash stays unexposed.
--   * A CHECK mirrors the app/function validation as a DB backstop.

alter table public.votes
  add column pen_winner text,
  add constraint votes_pen_winner_chk
    check (pen_winner is null or pen_winner in ('home', 'away'));

comment on column public.votes.pen_winner is
  'Optional knockout penalty-shootout winner call: ''home'' | ''away'' | null. Written via the cast-vote Edge Function; scores 0.5 in the ranking when correct.';

-- Additive column grant for the public read side (the view is security_invoker,
-- so anon must hold SELECT on this column to read it through the view).
grant select (pen_winner) on public.votes to anon, authenticated;

-- Recreate the public feed view to surface pen_winner. CREATE OR REPLACE requires
-- the existing columns in the same order, so pen_winner is appended at the END
-- (the client maps rows by name, so order is irrelevant). Still security_invoker,
-- so it honors RLS + the column grants and can never leak ip_hash. Newest first.
create or replace view public.vote_entries
  with (security_invoker = true)
as
  select
    match_id,
    league,
    username,
    pred_home,
    pred_away,
    created_at,
    pen_winner
  from public.votes
  order by created_at desc;

grant select on public.vote_entries to anon, authenticated;
