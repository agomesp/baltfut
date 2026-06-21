-- One-off cleanup: chief117 palpited TUN x JPN (760449) ~16h AFTER full time
-- (before the per-match cutoff existed), an exact 0-4 that inflated the ranking.
-- Remove it so wins/losses are accurate. No-op on a fresh DB.
delete from public.votes
where match_id = '760449' and lower(username) = 'chief117';
