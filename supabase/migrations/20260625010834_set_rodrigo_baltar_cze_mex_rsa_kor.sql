-- Owner-requested manual palpites for two LIVE Group A games. The cast-vote Edge
-- Function write path is blocked after kickoff+5min (and by one-per-IP), so this
-- is applied directly to the DB, mirroring the earlier Rodrigo Baltar one-offs:
--   CZE x MEX (760467): Rodrigo Baltar -> CZE 1 x 2 MEX   (CZE is HOME)
--   RSA x KOR (760466): Rodrigo Baltar -> RSA 1 x 2 KOR   (RSA is HOME)
-- Idempotent + authoritative: clear any existing Rodrigo Baltar row for these
-- matches (case-insensitive) first, then insert exactly one each. Synthetic
-- ip_hash so it can't collide with a real client's one-per-IP slot.
delete from public.votes
where match_id in ('760467', '760466') and lower(username) = 'rodrigo baltar';

insert into public.votes (match_id, league, username, pred_home, pred_away, ip_hash)
values
  ('760467', 'fifa.world', 'Rodrigo Baltar', 1, 2, md5('manual:760467:rodrigo-baltar')),
  ('760466', 'fifa.world', 'Rodrigo Baltar', 1, 2, md5('manual:760466:rodrigo-baltar'));
