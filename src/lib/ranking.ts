import type { KnockoutColumn, Match } from "@/lib/espn";
import { matchShootout } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import { resolveBracketPicks, scoreBracketPicks, realWinnersByPos } from "@/lib/bracket-picks";

/** A saved knockout bracket, keyed by the same nickname as the score palpites. */
export interface BracketPalpite {
  username: string;
  picks: Record<string, string>;
}

/**
 * Points each nickname earns from their saved bracket — 0.2 per correctly-picked
 * knockout winner (champion included), graded against the real knockout. Only
 * decided ties score (pending ones award nothing yet). Keyed by username, folded
 * into the same Ranking dos Subs as score palpites via {@link rankSubs}.
 */
export function bracketPointsByUser(
  brackets: BracketPalpite[],
  columns: KnockoutColumn[],
): Record<string, number> {
  const realWinners = realWinnersByPos(columns);
  const out: Record<string, number> = {};
  for (const b of brackets) {
    // frozen: score the user's OWN picks (locked reality ties don't count).
    const { rounds } = resolveBracketPicks(columns, b.picks, true);
    const { total } = scoreBracketPicks(rounds, realWinners);
    if (total > 0) out[b.username] = (out[b.username] ?? 0) + total;
  }
  return out;
}

/** The slice of a match needed to grade a palpite — satisfied by a full `Match`
 *  (from ESPN) OR a durable row from the `match_results` table, so the ranking can
 *  prefer our stored snapshot and stop depending on ESPN's live feed. */
export type MatchResult = Pick<Match, "state" | "homeScore" | "awayScore" | "homeShootout" | "awayShootout">;

export interface SubRank {
  username: string;
  /** Exact-score hits + 0.5 per correct penalty-winner call. May be fractional. */
  wins: number;
  losses: number;
  /** Correct / wrong penalty-winner calls (only on matches decided on pens). The
   *  0.5 per correct call is already folded into `wins`; these are the breakdown. */
  penWins: number;
  penLosses: number;
}

/**
 * Wins/losses per nickname across finished matches. A win is an exact final-score
 * prediction (+1); anything else on a finished match is a loss. When the tie was
 * decided on penalties and the sub called a winner, a correct call adds +0.5 (a
 * wrong one only bumps the pen-loss breakdown). Every palpite on a finished match
 * counts (the kickoff+5min form lock already prevents late ones). Sorted by wins
 * (correct palpites, incl. the pen halves) desc, then name — losses are tallied
 * for display but never affect the order, so a wrong palpite costs nothing in rank.
 *
 * `bracketPoints` (username → 0.2-per-correct-winner from {@link bracketPointsByUser})
 * folds into the SAME table: added to a sub's wins, and surfacing a bracket-only
 * nickname (no score palpites) as its own row.
 */
export function rankSubs(
  entries: VoteEntry[],
  matchesById: Record<string, MatchResult>,
  bracketPoints: Record<string, number> = {},
): SubRank[] {
  const tally = new Map<string, { wins: number; losses: number; penWins: number; penLosses: number }>();

  for (const e of entries) {
    const m = matchesById[e.matchId];
    if (!m || m.state !== "post" || m.homeScore == null || m.awayScore == null) {
      continue;
    }
    const t = tally.get(e.username) ?? { wins: 0, losses: 0, penWins: 0, penLosses: 0 };
    if (e.predHome === m.homeScore && e.predAway === m.awayScore) t.wins += 1;
    else t.losses += 1;
    // Penalty bonus: only when the tie actually went to pens AND they called a
    // winner. Correct → half a point (and a pen-win); wrong → just a pen-loss.
    const so = matchShootout(m);
    if (so && e.penWinner) {
      if (e.penWinner === so.winner) {
        t.penWins += 1;
        t.wins += 0.5;
      } else {
        t.penLosses += 1;
      }
    }
    tally.set(e.username, t);
  }

  // Fold in bracket points (0.2 per correct knockout winner). A nickname with only
  // a bracket and no score palpites still gets a row.
  for (const [username, pts] of Object.entries(bracketPoints)) {
    if (!(pts > 0)) continue;
    const t = tally.get(username) ?? { wins: 0, losses: 0, penWins: 0, penLosses: 0 };
    t.wins += pts;
    tally.set(username, t);
  }

  return [...tally.entries()]
    .map(([username, v]) => ({ username, ...v }))
    .sort((a, b) => b.wins - a.wins || a.username.localeCompare(b.username));
}

/** A one-vs-one duel between two nicknames (e.g. the house bot "ChatGPT" vs the
 *  viewer), scored on the matches BOTH palpitado — a fair head-to-head. */
export interface HeadToHead {
  /** Finished matches both names palpitado (the fair comparison set). */
  shared: number;
  /** Exact-score hits for side A / side B among the shared matches. */
  aHits: number;
  bHits: number;
  /** Who's ahead on hits. */
  lead: "a" | "b" | "tie";
  /** The most recent shared finished match (by kickoff), for a recap line. */
  last: { home: number; away: number; aHit: boolean; bHit: boolean } | null;
}

/**
 * Head-to-head between nicknames `a` and `b` over the FINISHED matches both
 * palpitado: exact-score hits each, who leads, and the latest shared result. Pure
 * (case-insensitive); an empty/absent name on either side yields an empty duel.
 */
export function headToHead(
  entries: VoteEntry[],
  matchesById: Record<string, Match>,
  a: string,
  b: string,
): HeadToHead {
  const la = a.trim().toLowerCase();
  const lb = b.trim().toLowerCase();
  const empty: HeadToHead = { shared: 0, aHits: 0, bHits: 0, lead: "tie", last: null };
  if (!la || !lb || la === lb) return empty;

  const aPicks = new Map<string, VoteEntry>();
  const bPicks = new Map<string, VoteEntry>();
  for (const e of entries) {
    const u = e.username.trim().toLowerCase();
    if (u === la) aPicks.set(e.matchId, e);
    else if (u === lb) bPicks.set(e.matchId, e);
  }

  let shared = 0;
  let aHits = 0;
  let bHits = 0;
  let last: HeadToHead["last"] = null;
  let lastKick = "";
  for (const [matchId, ae] of aPicks) {
    const be = bPicks.get(matchId);
    if (!be) continue;
    const m = matchesById[matchId];
    if (!m || m.state !== "post" || m.homeScore == null || m.awayScore == null) continue;
    shared += 1;
    const aHit = ae.predHome === m.homeScore && ae.predAway === m.awayScore;
    const bHit = be.predHome === m.homeScore && be.predAway === m.awayScore;
    if (aHit) aHits += 1;
    if (bHit) bHits += 1;
    const kick = m.startsAt ?? "";
    if (kick >= lastKick) {
      lastKick = kick;
      last = { home: m.homeScore, away: m.awayScore, aHit, bHit };
    }
  }
  return { shared, aHits, bHits, lead: aHits > bHits ? "a" : bHits > aHits ? "b" : "tie", last };
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
