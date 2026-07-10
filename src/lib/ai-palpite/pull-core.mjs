// Pure "raw ESPN scoreboard → ChatGPT palpite rows" transform, shared by the cron
// script (scripts/ai-palpite-pull.mjs) and its vitest (pull-core.test.ts). Plain
// ESM so Node can import it; kept side-effect-free so it's trivially testable.

import { predictScore, strongerCode, teamPower } from "./core.mjs";

// Knockout stage slugs (ESPN `season.slug`), mirroring KNOCKOUT_STAGES in
// ai-palpite/model.ts. A tie in these rounds can't end level.
const KNOCKOUT_SLUGS = new Set([
  "round-of-32",
  "round-of-16",
  "quarterfinals",
  "semifinals",
  "3rd-place-match",
  "final",
]);

// Mirror of espn/bracket.ts isPlaceholderTeam: a not-yet-decided knockout seed
// reads as "Winner Group A" / "Round of 16" etc., never a real nation.
const PLACEHOLDER_RE =
  /\b(Group|Place|Winner|Loser|Round of|Quarterfinal|Semifinal|Third)\b/i;

function isDecidedName(name) {
  return typeof name === "string" && name.length > 0 && !PLACEHOLDER_RE.test(name);
}

/**
 * Build the ChatGPT palpite rows for every fixture with two DECIDED teams — group
 * games and resolved knockout ties alike, at ANY state (pre/in/post) so a missed
 * past match is backfilled. Ties still on seeds ("Winner Group A") are skipped;
 * the cron records them the moment ESPN fills in the real teams.
 *
 * Each row: { match_id, league, pred_home, pred_away, pen_winner }. On a knockout
 * tie the model predicts level, it also calls the shootout winner (the stronger
 * side, "home"|"away"); otherwise pen_winner is null.
 *
 * @param {any[]} events  ESPN scoreboard `events`
 * @param {string} league league slug (e.g. "fifa.world")
 */
export function buildAiPalpiteItems(events, league) {
  const items = [];
  for (const e of events ?? []) {
    const comp = e?.competitions?.[0];
    const home = comp?.competitors?.find((c) => c.homeAway === "home");
    const away = comp?.competitors?.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    const hCode = home.team?.abbreviation;
    const aCode = away.team?.abbreviation;
    if (!hCode || !aCode) continue;
    // Both sides must be real nations (parse.ts maps the name from displayName).
    if (!isDecidedName(home.team?.displayName) || !isDecidedName(away.team?.displayName)) {
      continue;
    }

    const score = predictScore(teamPower(hCode), teamPower(aCode));
    const knockout = KNOCKOUT_SLUGS.has(e?.season?.slug ?? "");
    const penWinner =
      knockout && score.winner === "draw"
        ? strongerCode(hCode, aCode) === hCode
          ? "home"
          : "away"
        : null;

    items.push({
      match_id: String(e.id),
      league,
      pred_home: score.home,
      pred_away: score.away,
      pen_winner: penWinner,
    });
  }
  return items;
}
