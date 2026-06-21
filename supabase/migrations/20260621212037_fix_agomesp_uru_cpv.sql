-- One-off data correction: agomesp's URU x CPV (match 760450) palpite was
-- overwritten to 0-0 during testing; restore it to the intended 1-1. Only this
-- row is touched. No-op on a fresh database (the row won't exist there).
update public.votes
set pred_home = 1, pred_away = 1
where match_id = '760450' and lower(username) = 'agomesp';
