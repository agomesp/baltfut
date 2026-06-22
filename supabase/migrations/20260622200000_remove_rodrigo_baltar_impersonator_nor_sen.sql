-- Remove a homoglyph-impersonation troll palpite on NOR x SEN (match 760454):
-- "Rodrigo BaItar" (capital-I U+0049 in place of the lowercase-l in the real
-- "Rodrigo Baltar") dropped a 0 x 30 max-score sentinel to game the ranking.
-- lower('Rodrigo BaItar') = 'rodrigo baitar' ≠ 'rodrigo baltar', so this targets
-- ONLY the impersonator and never the real user's rows. Scoped to the match too.
-- Idempotent; no-op if already gone.
delete from public.votes
where match_id = '760454' and lower(username) = 'rodrigo baitar';
