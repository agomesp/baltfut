import type { Match } from "@/lib/espn";

/** A team's recent finished match, from that team's perspective (V / E / D). */
export interface TeamHistoryGame {
  /** Opponent full name (e.g. "Croácia" once localized upstream). */
  opp: string;
  /** Opponent short code (e.g. "CRO"). */
  oppCode: string;
  /** Score from the team's own perspective, e.g. "2–1". */
  score: string;
  /** Vitória / Empate / Derrota. */
  res: "V" | "E" | "D";
}

/**
 * The team's last `limit` finished matches in the dataset, newest first. Used by
 * the pre-match "{TEAM} · NA COPA" history columns. Score and result are oriented
 * to the queried team (goals-for first), so "2–1 V" means they won 2–1.
 */
export function teamCupHistory(
  matches: Match[],
  teamCode: string,
  limit = 3,
): TeamHistoryGame[] {
  return matches
    .filter(
      (m) =>
        m.state === "post" &&
        m.homeScore != null &&
        m.awayScore != null &&
        (m.home.abbreviation === teamCode || m.away.abbreviation === teamCode),
    )
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, limit)
    .map((m) => {
      const isHome = m.home.abbreviation === teamCode;
      const gf = (isHome ? m.homeScore : m.awayScore) as number;
      const ga = (isHome ? m.awayScore : m.homeScore) as number;
      const opp = isHome ? m.away : m.home;
      const res: TeamHistoryGame["res"] = gf > ga ? "V" : gf < ga ? "D" : "E";
      return { opp: opp.name, oppCode: opp.abbreviation, score: `${gf}–${ga}`, res };
    });
}
