-- Owner-requested removal: Rodrigo Baltar entered the wrong palpite for
-- FRA x IRQ (match 760457). Delete it so he can re-enter (the form is otherwise
-- locked by one-per-IP-per-match). Case-insensitive on the name; no-op if absent.
delete from public.votes
where match_id = '760457' and lower(username) = 'rodrigo baltar';
