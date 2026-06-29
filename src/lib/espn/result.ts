import type { Match, Side } from "@/lib/espn/types";

export interface Shootout {
  /** Home penalty-shootout tally. */
  home: number;
  /** Away penalty-shootout tally. */
  away: number;
  /** Side that won the shootout (and therefore advanced). */
  winner: Side;
}

/**
 * The penalty-shootout result for a knockout tie decided on penalties, or null
 * when the match wasn't a shootout (no tally — or, defensively, an equal tally).
 * The regulation/AET scoreline stays on `homeScore`/`awayScore`; this is the
 * separate spot-kick tally used to show "(pên 4–2)" and the advancing side.
 */
export function matchShootout(m: Match): Shootout | null {
  const h = m.homeShootout;
  const a = m.awayShootout;
  if (h == null || a == null || h === a) return null;
  return { home: h, away: a, winner: h > a ? "home" : "away" };
}
