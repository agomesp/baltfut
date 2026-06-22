-- ============================================================================
-- Seed the "ChatGPT" house-bot palpites for every upcoming real-nation fixture
-- (group stage from 2026-06-22 onward). Knockout slots are excluded — their
-- teams are still placeholders (TBD), so there is nothing to predict.
--
-- These are inserted directly (service_role), NOT through the cast-vote function,
-- because:
--   * "ChatGPT" is a RESERVED name the function rejects for everyone (see
--     _shared/name-claim.ts isReservedName) — the bot is the sole exception, and
--     this admin path is the only way it can be written.
--   * a synthetic ip_hash (md5('chatgpt:'||match_id)) keeps each row from
--     colliding with a real client's one-per-IP slot and from clashing on the
--     one-name-per-match index.
-- Idempotent: re-running is a no-op (on conflict do nothing).
--
-- Scorelines are the model's straight-up predictions per matchup.
-- ============================================================================
insert into public.votes (match_id, league, username, pred_home, pred_away, ip_hash)
select v.match_id, 'fifa.world', 'ChatGPT', v.pred_home, v.pred_away,
       md5('chatgpt:' || v.match_id)
from (values
  ('760452', 1, 2),  -- NZL x EGY
  ('760456', 2, 0),  -- ARG x AUT
  ('760457', 3, 0),  -- FRA x IRQ
  ('760454', 2, 1),  -- NOR x SEN
  ('760455', 1, 2),  -- JOR x ALG
  ('760461', 3, 0),  -- POR x UZB
  ('760458', 2, 0),  -- ENG x GHA
  ('760460', 0, 2),  -- PAN x CRO
  ('760459', 2, 0),  -- COL x COD
  ('760462', 2, 1),  -- BIH x QAT
  ('760463', 1, 1),  -- SUI x CAN
  ('760464', 3, 0),  -- MAR x HAI
  ('760465', 0, 2),  -- SCO x BRA
  ('760466', 1, 2),  -- RSA x KOR
  ('760467', 1, 1),  -- CZE x MEX
  ('760468', 1, 2),  -- ECU x GER
  ('760473', 0, 2),  -- CUW x CIV
  ('760471', 2, 1),  -- JPN x SWE
  ('760472', 0, 2),  -- TUN x NED
  ('760469', 1, 1),  -- PAR x AUS
  ('760470', 2, 1),  -- TUR x USA
  ('760474', 2, 0),  -- SEN x IRQ
  ('760475', 1, 2),  -- NOR x FRA
  ('760478', 1, 1),  -- CPV x KSA
  ('760479', 1, 2),  -- URU x ESP
  ('760476', 1, 1),  -- EGY x IRN
  ('760477', 0, 3),  -- NZL x BEL
  ('760480', 2, 0),  -- CRO x GHA
  ('760485', 0, 2),  -- PAN x ENG
  ('760481', 1, 2),  -- COL x POR
  ('760482', 1, 1),  -- COD x UZB
  ('760483', 0, 3),  -- JOR x ARG
  ('760484', 1, 1)   -- ALG x AUT
) as v(match_id, pred_home, pred_away)
on conflict do nothing;
