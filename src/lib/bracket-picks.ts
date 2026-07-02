import type { KnockoutColumn } from "@/lib/espn";
import { matchShootout } from "@/lib/espn";
import { R16_FROM_R32, QF_FROM_R16, SF_FROM_QF, FINAL_FROM_SF } from "@/lib/bracket-shape";

/**
 * Interactive knockout-prediction logic. The user picks a winner for every tie
 * from the round of 32 up to the final; each pick advances that team into the next
 * round's slot (following the real FIFA wiring in `bracket-shape`). Pure and
 * deterministic — the component just stores `picks` and renders `resolveBracketPicks`.
 */

/** Round index: 0 = 32-avos, 1 = oitavas, 2 = quartas, 3 = semis, 4 = final. */
export const ROUND_LABELS = ["32-avos", "Oitavas", "Quartas", "Semifinais", "Final"] as const;

// Feeder tie numbers (1-based, previous round) for each tie of rounds 1..4.
const FEEDERS: (readonly (readonly [number, number])[] | null)[] = [
  null,
  R16_FROM_R32,
  QF_FROM_R16,
  SF_FROM_QF,
  FINAL_FROM_SF,
];

/** A round-of-32 tie's two real teams (by code). */
export interface R32Slot {
  home: string;
  away: string;
}

/** A tie in the resolved prediction bracket. `home`/`away` are null until both
 *  feeders are picked; `pickedWinner` is the user's chosen advancer. */
export interface PickTie {
  home: string | null;
  away: string | null;
  pickedWinner: string | null;
}

/** Stable key for a tie position (round + index), used as the picks map key. */
export function posKey(round: number, tie: number): string {
  return `${round}-${tie}`;
}

/**
 * Resolve the whole prediction bracket from the round-of-32 real teams + the
 * user's picks. Rounds 1..4 fill from the previous round's picked winners; a pick
 * that no longer matches its (possibly-changed) slot teams is dropped, so
 * de-selecting a team cascades forward automatically. Returns the rendered rounds,
 * the champion (final pick), and the CLEANED picks to store back.
 */
export function resolveBracketPicks(
  r32: R32Slot[],
  picks: Record<string, string>,
): { rounds: PickTie[][]; champion: string | null; picks: Record<string, string> } {
  const clean: Record<string, string> = { ...picks };
  const rounds: PickTie[][] = [];

  rounds[0] = r32.map((m, i) => {
    const k = posKey(0, i);
    let p: string | null = clean[k] ?? null;
    if (p && p !== m.home && p !== m.away) {
      delete clean[k];
      p = null;
    }
    return { home: m.home, away: m.away, pickedWinner: p };
  });

  for (let r = 1; r <= 4; r++) {
    const feeders = FEEDERS[r]!;
    rounds[r] = feeders.map(([a, b], j) => {
      const home = rounds[r - 1][a - 1]?.pickedWinner ?? null;
      const away = rounds[r - 1][b - 1]?.pickedWinner ?? null;
      const k = posKey(r, j);
      let p: string | null = clean[k] ?? null;
      if (p && p !== home && p !== away) {
        delete clean[k];
        p = null;
      }
      return { home, away, pickedWinner: p };
    });
  }

  return { rounds, champion: rounds[4][0].pickedWinner, picks: clean };
}

/** Toggle a pick: selecting a team sets it, clicking the current pick removes it.
 *  The caller re-runs `resolveBracketPicks` to cascade-clean downstream picks. */
export function togglePick(
  picks: Record<string, string>,
  round: number,
  tie: number,
  team: string,
): Record<string, string> {
  const k = posKey(round, tie);
  const next = { ...picks };
  if (next[k] === team) delete next[k];
  else next[k] = team;
  return next;
}

const ROUND_BY_SLUG: Record<string, number> = {
  "round-of-32": 0,
  "round-of-16": 1,
  quarterfinals: 2,
  semifinals: 3,
  final: 4,
};

/** The REAL advancer at each tie position, from the live knockout columns — a
 *  finished match's winner (shootout-aware). Positions with no result yet are
 *  absent (they score as "pending"). */
export function realWinnersByPos(columns: KnockoutColumn[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of columns) {
    const round = ROUND_BY_SLUG[col.slug];
    if (round === undefined) continue; // skip the 3rd-place match
    col.matches.forEach((m, i) => {
      if (m.state !== "post" || m.homeScore == null || m.awayScore == null) return;
      const so = matchShootout(m);
      const winnerHome = so ? so.winner === "home" : m.homeScore >= m.awayScore;
      out[posKey(round, i)] = winnerHome ? m.home.abbreviation : m.away.abbreviation;
    });
  }
  return out;
}

export type PickVerdict = "correct" | "wrong" | "pending";

/** Score a saved bracket: 0.2 per correct winner, 1 for a correct champion (the
 *  final's winner). Returns the total plus a per-position verdict for green/red. */
export function scoreBracketPicks(
  rounds: PickTie[][],
  realWinners: Record<string, string>,
): { total: number; byPos: Record<string, PickVerdict> } {
  let total = 0;
  const byPos: Record<string, PickVerdict> = {};
  for (let r = 0; r < rounds.length; r++) {
    rounds[r].forEach((tie, i) => {
      const pick = tie.pickedWinner;
      if (!pick) return;
      const k = posKey(r, i);
      const real = realWinners[k];
      if (!real) {
        byPos[k] = "pending";
        return;
      }
      if (pick === real) {
        total += r === 4 ? 1 : 0.2;
        byPos[k] = "correct";
      } else {
        byPos[k] = "wrong";
      }
    });
  }
  return { total, byPos };
}
