-- One nickname per match: stops two different people both palpitando as "Allan"
-- on the same match. Case-insensitive.
--
-- Existing duplicates (from when this wasn't enforced) would block the unique
-- index, so first keep the earliest palpite per (match, lower(name)) and drop
-- the later ones.
delete from public.votes a
using public.votes b
where a.match_id = b.match_id
  and lower(a.username) = lower(b.username)
  and (a.created_at > b.created_at
       or (a.created_at = b.created_at and a.ctid > b.ctid));

create unique index votes_one_name_per_match
  on public.votes (match_id, lower(username));
