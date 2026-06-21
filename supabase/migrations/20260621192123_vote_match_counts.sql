-- Per-match prediction counts, so the UI can tell which matches have palpites
-- (e.g. which finished games to surface in the chip carousel) without scanning
-- every vote. security_invoker = true: runs as the caller, honoring the same
-- column grants as vote_entries — it exposes only match_id + an aggregate count,
-- never ip_hash.
create view public.vote_match_counts
  with (security_invoker = true)
as
  select match_id, count(*)::int as votes
  from public.votes
  group by match_id;

comment on view public.vote_match_counts is
  'Prediction count per match_id, for the UI to flag matches that have palpites.';

grant select on public.vote_match_counts to anon, authenticated;
