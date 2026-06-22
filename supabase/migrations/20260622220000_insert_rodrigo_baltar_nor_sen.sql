-- Owner-requested manual palpite: NOR x SEN (match 760454), Rodrigo Baltar
-- NOR 2 x 1 SEN. NOR is home → pred_home=2, pred_away=1. Synthetic ip_hash so it
-- can't collide with a real client's one-per-IP slot. Idempotent: clears any
-- existing Rodrigo Baltar row for this match first, then inserts exactly one.
delete from public.votes
where match_id = '760454' and lower(username) = 'rodrigo baltar';

insert into public.votes (match_id, league, username, pred_home, pred_away, ip_hash)
values ('760454', 'fifa.world', 'Rodrigo Baltar', 2, 1, md5('manual:760454:rodrigo-baltar'));
