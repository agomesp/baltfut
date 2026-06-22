-- One-off manual palpite change requested by the owner, mid-match (HT):
--   ARG x AUT (match 760456): Rodrigo Baltar -> ARG 3 x 0 AUT
--   ARG is the HOME side, so pred_home = 3, pred_away = 0.
-- Done directly in the DB because the Edge Function write path is blocked after
-- kickoff+5min (and by one-per-IP). His earlier troll 30x30 row was already
-- removed; this re-creates his palpite at 3-0.
-- Idempotent + authoritative: clear any existing Rodrigo Baltar row for this
-- match first (case-insensitive), then insert exactly one. Synthetic ip_hash so
-- it can't collide with a real client's one-per-IP slot.
delete from public.votes
where match_id = '760456' and lower(username) = 'rodrigo baltar';

insert into public.votes (match_id, league, username, pred_home, pred_away, ip_hash)
values ('760456', 'fifa.world', 'Rodrigo Baltar', 3, 0, md5('manual:760456:rodrigo-baltar'));
