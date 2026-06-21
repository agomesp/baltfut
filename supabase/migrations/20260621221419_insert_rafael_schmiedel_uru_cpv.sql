-- One-off manual palpite insert requested by the owner:
--   URU x CPV (match 760450): Rafael Schmiedel  URU 2 x 1 CPV
-- Direct insert (the Edge Function path is blocked by one-per-IP for an admin).
-- Synthetic ip_hash so it can't collide with a real client's one-per-IP slot.
-- Idempotent: re-running (or the name/ip already existing) is a no-op.
insert into public.votes (match_id, league, username, pred_home, pred_away, ip_hash)
values ('760450', 'fifa.world', 'Rafael Schmiedel', 2, 1, md5('manual:760450:rafael-schmiedel'))
on conflict do nothing;
