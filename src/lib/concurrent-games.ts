import type { Match } from "@/lib/espn";

/**
 * Decides whether the live screen shows ONE game or TWO concurrent ones, and
 * which. Replaces the manual PLACAR/2 JOGOS toggle with an automatic rule:
 *
 *  - Two games that kick off at the SAME time (e.g. the final group round) pair
 *    up — pre-match they share the "palpita os 2 jogos" form anytime before
 *    kickoff; live they show side by side.
 *  - When a game starts in the MIDDLE of another (overlapping but staggered),
 *    the pair opens 10 minutes before the later one kicks off, and collapses
 *    back to a single game when the first one finishes (showing the one left).
 *
 * "single" mode forces one game (a manual override kept for testing).
 */
export type ViewMode = "single" | "auto";

/** Wall-clock span of a match for overlap detection (90 + halftime + stoppage). */
export const MATCH_SPAN_MS = 120 * 60_000;
/** A game appears this long before kickoff (the duo "warms up" 10 min early). */
export const LEAD_MS = 10 * 60_000;

export interface ConcurrentDecision {
  /** The main game to show. */
  primary: Match;
  /** A second game to co-show, or null when the single view is right. */
  partner: Match | null;
}

const ko = (m: Match) => Date.parse(m.startsAt);
const ended = (m: Match) => m.state === "post";

/**
 * The unfinished game (≠ selected) whose match window overlaps the selected's —
 * closest kickoff first, so a simultaneous game beats a merely-overlapping one.
 */
export function concurrentPartner(selected: Match, matches: Match[]): Match | null {
  const s0 = ko(selected);
  if (Number.isNaN(s0)) return null;
  const s1 = s0 + MATCH_SPAN_MS;
  const cands = matches.filter((g) => {
    if (g.id === selected.id || ended(g)) return false;
    const g0 = ko(g);
    return !Number.isNaN(g0) && g0 < s1 && g0 + MATCH_SPAN_MS > s0;
  });
  if (cands.length === 0) return null;
  return cands.slice().sort((a, b) => Math.abs(ko(a) - s0) - Math.abs(ko(b) - s0))[0];
}

export function decideConcurrent(
  selected: Match,
  matches: Match[],
  now: number,
  viewMode: ViewMode,
): ConcurrentDecision {
  if (viewMode === "single") return { primary: selected, partner: null };

  const partner = concurrentPartner(selected, matches);
  if (!partner) return { primary: selected, partner: null };

  const simultaneous = Math.abs(ko(selected) - ko(partner)) < 60_000;

  // Pre-match palpite of two simultaneous games: pair them anytime before kickoff.
  if (selected.state === "pre" && partner.state === "pre" && simultaneous) {
    return { primary: selected, partner };
  }

  // Live / overlap: co-show from 10 min before the LATER kickoff until one ends.
  const laterKickoff = Math.max(ko(selected), ko(partner));
  if (!ended(selected) && now >= laterKickoff - LEAD_MS) {
    return { primary: selected, partner };
  }

  // Single view. If the selected has finished but the partner is still going,
  // follow the remaining game.
  if (ended(selected)) return { primary: partner, partner: null };
  return { primary: selected, partner: null };
}
