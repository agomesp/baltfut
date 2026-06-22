-- Rodrigo Baltar dropped a troll 30 x 30 palpite on ARG x AUT (match 760456),
-- the max-score sentinel used to game the live "ganhando/pode ganhar" ranking.
-- Remove it. Case-insensitive on the name; no-op on a fresh DB.
delete from public.votes
where match_id = '760456' and lower(username) = 'rodrigo baltar';
