-- Ongoing "ChatGPT" house-bot palpites. The 2026-06-22 seed
-- (20260622030000_seed_chatgpt_palpites.sql) was a ONE-TIME static insert of ~33
-- group games; every later group game and every knockout tie never got a bot
-- palpite, so ChatGPT stalled in the Ranking dos Subs. This RPC lets a cron
-- (scripts/ai-palpite-pull.mjs → ai-palpites.yml) fill every fixture with two
-- decided teams, forever — backfilling the misses and pre-filling upcoming games.
--
-- Fair despite recording late / after a match: the model is DETERMINISTIC and
-- hindsight-free (fixed pre-tournament strength ratings, never results), so the
-- bot's pick for a matchup is identical whenever it's computed. Writes bypass the
-- cast-vote cutoff on purpose — ChatGPT is the house bot, written server-side
-- (service_role), never through the public client (the name is reserved there).
--
-- Mirrors set_match_results (20260702140000): anon can't execute; service_role
-- only; SECURITY DEFINER; `on conflict do nothing` so a recorded pick is NEVER
-- rewritten (locks the prediction, and preserves the hand-authored 2026-06-22
-- seed rows). A synthetic ip_hash md5('chatgpt:'||match_id) keeps each row out of
-- a real client's one-per-IP slot, exactly like the seed.
create or replace function public.set_ai_palpites(items jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $func$
declare
  inserted integer;
begin
  insert into public.votes (match_id, league, username, pred_home, pred_away, pen_winner, ip_hash)
  select x.match_id, x.league, 'ChatGPT', x.pred_home, x.pred_away, x.pen_winner,
         md5('chatgpt:' || x.match_id)
  from jsonb_to_recordset(items) as x(
    match_id text, league text, pred_home int, pred_away int, pen_winner text
  )
  on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$func$;

-- Lock execution to service_role (the cron), same as set_match_results/set_promos.
revoke all on function public.set_ai_palpites(jsonb) from public, anon, authenticated;
grant execute on function public.set_ai_palpites(jsonb) to service_role;
