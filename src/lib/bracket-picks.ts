import type { KnockoutColumn, Match } from "@/lib/espn";
import { matchShootout } from "@/lib/espn";
import { R16_FROM_R32, QF_FROM_R16, SF_FROM_QF, FINAL_FROM_SF, ROUND_SIZES } from "@/lib/bracket-shape";

/**
 * Interactive knockout-prediction logic. The user picks a winner for every tie
 * that HASN'T kicked off yet; each pick advances that team into the next round's
 * slot (following the real FIFA wiring in `bracket-shape`).
 *
 * A tie whose real match has STARTED (state ≠ "pre") is LOCKED: it can't be
 * picked, and the REAL result auto-advances (so a viewer arriving late can't
 * predict a match already under way). Locked finished matches advance the real
 * winner; locked live matches wait for the result. Pure and deterministic.
 */

/** Round index: 0 = 32-avos, 1 = oitavas, 2 = quartas, 3 = semis, 4 = final. */
export const ROUND_LABELS = ["32-avos", "Oitavas", "Quartas", "Semifinais", "Final"] as const;

// Feeder tie numbers (1-based, previous round) for each tie of rounds 1..4.
const FEEDERS: (readonly (readonly [number, number])[] | null)[] = [
  null, R16_FROM_R32, QF_FROM_R16, SF_FROM_QF, FINAL_FROM_SF,
];

const SLUG_BY_ROUND = ["round-of-32", "round-of-16", "quarterfinals", "semifinals", "final"] as const;

/** A tie in the resolved prediction bracket. */
export interface PickTie {
  home: string | null;
  away: string | null;
  /** The user's chosen advancer (null on a locked tie — reality decides it). */
  pickedWinner: string | null;
  /** Who advances: the pick on an open tie, or the real winner on a locked one. */
  advancer: string | null;
  /** The real match kicked off → not editable; reality is used. */
  locked: boolean;
  /** Real winner of a locked+finished tie (else null). */
  realWinner: string | null;
  /** The locked tie is in progress (no winner yet). */
  live: boolean;
}

/** Stable key for a tie position (round + index), used as the picks map key. */
export function posKey(round: number, tie: number): string {
  return `${round}-${tie}`;
}

/** Real matches grouped by round index (0..4), from the live knockout columns. */
function roundMatches(columns: KnockoutColumn[]): Match[][] {
  const bySlug = new Map(columns.map((c) => [c.slug, c.matches]));
  return SLUG_BY_ROUND.map((slug) => bySlug.get(slug) ?? []);
}

/** The shootout-aware winner code of a finished match, else null. */
function winnerOf(m: Match): string | null {
  if (m.state !== "post" || m.homeScore == null || m.awayScore == null) return null;
  const so = matchShootout(m);
  const home = so ? so.winner === "home" : m.homeScore >= m.awayScore;
  return home ? m.home.abbreviation : m.away.abbreviation;
}

/**
 * Resolve the whole prediction bracket from the live knockout + the user's picks.
 * `frozen` = a saved palpite: the user's picks stay put and are scored; only ties
 * they never picked fall back to reality. Editing (`frozen` false): every started
 * tie locks to reality and any pick on it is dropped. Returns the rendered rounds,
 * the champion (final advancer) and the CLEANED picks to store back.
 */
export function resolveBracketPicks(
  columns: KnockoutColumn[],
  picks: Record<string, string>,
  frozen = false,
): { rounds: PickTie[][]; champion: string | null; picks: Record<string, string> } {
  const real = roundMatches(columns);
  const clean: Record<string, string> = { ...picks };
  const rounds: PickTie[][] = [];

  for (let r = 0; r <= 4; r++) {
    const feeders = FEEDERS[r];
    rounds[r] = Array.from({ length: ROUND_SIZES[r] }, (_, i) => {
      const m = real[r]?.[i] ?? null;
      const started = !!m && m.state !== "pre";
      const k = posKey(r, i);
      const hasPick = clean[k] != null;
      // Editing: any started tie locks. Saved: only started ties the user never
      // picked lock (their own picks stay, to be scored green/red).
      const locked = frozen ? started && !hasPick : started;

      if (locked && m) {
        delete clean[k];
        const rw = winnerOf(m);
        return {
          home: m.home.abbreviation,
          away: m.away.abbreviation,
          pickedWinner: null,
          advancer: rw,
          locked: true,
          realWinner: rw,
          live: m.state === "in",
        };
      }

      let home: string | null;
      let away: string | null;
      if (r === 0) {
        home = m ? m.home.abbreviation : null;
        away = m ? m.away.abbreviation : null;
      } else {
        const [a, b] = feeders![i];
        home = rounds[r - 1][a - 1].advancer;
        away = rounds[r - 1][b - 1].advancer;
      }
      let p: string | null = clean[k] ?? null;
      if (p && p !== home && p !== away) {
        delete clean[k];
        p = null;
      }
      return { home, away, pickedWinner: p, advancer: p, locked: false, realWinner: null, live: false };
    });
  }

  return { rounds, champion: rounds[4][0].advancer, picks: clean };
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

/** The REAL advancer at each tie position — a finished match's winner. Positions
 *  with no result yet are absent (they score as "pending"). */
export function realWinnersByPos(columns: KnockoutColumn[]): Record<string, string> {
  const out: Record<string, string> = {};
  roundMatches(columns).forEach((matches, round) => {
    matches.forEach((m, i) => {
      const w = winnerOf(m);
      if (w) out[posKey(round, i)] = w;
    });
  });
  return out;
}

export type PickVerdict = "correct" | "wrong" | "pending";

/** Points awarded per correctly-picked knockout winner — every round, champion
 *  included. Bracket points fold into the same Ranking dos Subs as score palpites. */
export const BRACKET_POINTS_PER_WINNER = 0.2;

/** Score a saved bracket: {@link BRACKET_POINTS_PER_WINNER} for every correct
 *  winner the user PICKED (all rounds, champion included). Locked/reality ties
 *  aren't the user's pick, so they don't score. Returns the total + a per-position
 *  verdict for green/red. */
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
      const winner = realWinners[k];
      if (!winner) {
        byPos[k] = "pending";
        return;
      }
      if (pick === winner) {
        total += BRACKET_POINTS_PER_WINNER;
        byPos[k] = "correct";
      } else {
        byPos[k] = "wrong";
      }
    });
  }
  return { total, byPos };
}
