-- "Ynsistent" got "Esse nome pertence a outra pessoa" when trying to palpite from
-- a new browser/IP: the name_claims row for his nickname is owned by a token_hash
-- that is NOT his current browser's localStorage token (and the claim is still
-- fresh), so the ownership check rejects him.
--
-- Clear the claim (his exact name + any same-skeleton look-alike claim) so the
-- name becomes UNOWNED. His next palpite via the form then re-registers it to his
-- current token. Idempotent; no-op if already gone.
delete from public.name_claims
where name_lower = 'ynsistent' or name_canon = 'ynsistent';
