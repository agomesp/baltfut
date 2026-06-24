import type { Match } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";

export interface SubRank {
  username: string;
  wins: number;
  losses: number;
}

/**
 * Wins/losses per nickname across finished matches. A win is an exact final-score
 * prediction; anything else on a finished match is a loss. Every palpite on a
 * finished match counts (the kickoff+5min form lock already prevents late ones).
 * Sorted by wins (correct palpites) desc, then name — losses are tallied for
 * display but never affect the order, so a wrong palpite costs nothing in rank.
 */
export function rankSubs(
  entries: VoteEntry[],
  matchesById: Record<string, Match>,
): SubRank[] {
  const tally = new Map<string, { wins: number; losses: number }>();

  for (const e of entries) {
    const m = matchesById[e.matchId];
    if (!m || m.state !== "post" || m.homeScore == null || m.awayScore == null) {
      continue;
    }
    const t = tally.get(e.username) ?? { wins: 0, losses: 0 };
    if (e.predHome === m.homeScore && e.predAway === m.awayScore) t.wins += 1;
    else t.losses += 1;
    tally.set(e.username, t);
  }

  return [...tally.entries()]
    .map(([username, v]) => ({ username, ...v }))
    .sort((a, b) => b.wins - a.wins || a.username.localeCompare(b.username));
}

/** The "pior palpiteiro": lowest hit-rate among subs with at least one graded palpite. */
export interface WorstSub {
  username: string;
  wins: number;
  losses: number;
  /** Hit rate as a fraction 0..1 (wins / (wins + losses)). */
  pct: number;
}

/**
 * Lowest win ratio in the table — the "Pior palpiteiro" footer. Only subs with a
 * graded palpite (wins + losses > 0) qualify (a 0–0 record has no rate). Ties go to
 * whoever rankSubs already placed first (it's pre-sorted), keeping output stable.
 */
export function worstPalpiteiro(ranks: SubRank[]): WorstSub | null {
  let worst: WorstSub | null = null;
  for (const r of ranks) {
    const total = r.wins + r.losses;
    if (total === 0) continue;
    const pct = r.wins / total;
    if (!worst || pct < worst.pct) {
      worst = { username: r.username, wins: r.wins, losses: r.losses, pct };
    }
  }
  return worst;
}
