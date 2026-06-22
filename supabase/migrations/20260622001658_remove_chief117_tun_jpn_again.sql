-- chief117 re-added a post-match TUN x JPN (760449) palpite again (exact 0-4,
-- placed long after FT). Remove it once more. No-op on a fresh DB.
delete from public.votes
where match_id = '760449' and lower(username) = 'chief117';
