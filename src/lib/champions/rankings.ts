import type { VoteEntry } from "@/lib/votes";
import type { MatchResult, SubRank } from "@/lib/ranking";
import { isReservedName } from "@shared/name-claim";

/**
 * The end-of-tournament boards for the champions screen. All pure over the same
 * inputs the live ranking uses (palpites + the graded match map), so they update
 * the moment the final's result lands.
 *
 * The house bot palpita every single fixture, so it would trivially win both the
 * podium and "most palpites". It's filtered out of every board here and surfaced
 * separately as a benchmark to beat (see {@link championsBoard}).
 */

interface Graded {
  entry: VoteEntry;
  home: number;
  away: number;
}

/** Palpites on matches that have actually finished, bot dropped. */
function graded(entries: VoteEntry[], byId: Record<string, MatchResult>): Graded[] {
  const out: Graded[] = [];
  for (const entry of entries) {
    if (isReservedName(entry.username)) continue;
    const m = byId[entry.matchId];
    if (!m || m.state !== "post" || m.homeScore == null || m.awayScore == null) continue;
    out.push({ entry, home: m.homeScore, away: m.awayScore });
  }
  return out;
}

const byName = (a: { username: string }, b: { username: string }) => a.username.localeCompare(b.username);

export interface HalfPointRow {
  username: string;
  /** 0.5 per side called exactly → an exact scoreline is a full point. */
  points: number;
  /** Matches where BOTH sides were right. */
  exact: number;
  /** Matches where exactly one side was right. */
  halves: number;
  matches: number;
}

/**
 * The consolation board: half a point for every team whose goals you called
 * exactly. Palpite 2×1 on a game that ends 0×1 still banks 0,5 for the away side.
 */
export function halfPointRanking(
  entries: VoteEntry[],
  byId: Record<string, MatchResult>,
): HalfPointRow[] {
  const tally = new Map<string, HalfPointRow>();
  for (const { entry, home, away } of graded(entries, byId)) {
    const row =
      tally.get(entry.username) ??
      { username: entry.username, points: 0, exact: 0, halves: 0, matches: 0 };
    const sides = (entry.predHome === home ? 1 : 0) + (entry.predAway === away ? 1 : 0);
    row.points += sides * 0.5;
    if (sides === 2) row.exact += 1;
    else if (sides === 1) row.halves += 1;
    row.matches += 1;
    tally.set(entry.username, row);
  }
  return [...tally.values()].sort((a, b) => b.points - a.points || byName(a, b));
}

export interface VolumeRow {
  username: string;
  palpites: number;
}

/** Who showed up the most — graded palpites per sub, biggest first. */
export function mostPalpitesRanking(
  entries: VoteEntry[],
  byId: Record<string, MatchResult>,
  cap = 5,
): VolumeRow[] {
  const tally = new Map<string, number>();
  for (const { entry } of graded(entries, byId)) {
    tally.set(entry.username, (tally.get(entry.username) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([username, palpites]) => ({ username, palpites }))
    .sort((a, b) => b.palpites - a.palpites || byName(a, b))
    .slice(0, cap);
}

export interface AccuracyRow {
  username: string;
  hits: number;
  palpites: number;
  /** hits / palpites, 0..1. */
  pct: number;
}

/**
 * Exact-score hit rate per sub, with anyone under `minPalpites` dropped so a tiny
 * sample can't top either board — one unlucky guess isn't "the worst", and one
 * lucky guess isn't "the best". Shared by both aproveitamento boards, which
 * differ only in which end of the list they read from.
 */
function accuracyRows(
  entries: VoteEntry[],
  byId: Record<string, MatchResult>,
  minPalpites: number,
): AccuracyRow[] {
  const tally = new Map<string, { hits: number; palpites: number }>();
  for (const { entry, home, away } of graded(entries, byId)) {
    const row = tally.get(entry.username) ?? { hits: 0, palpites: 0 };
    if (entry.predHome === home && entry.predAway === away) row.hits += 1;
    row.palpites += 1;
    tally.set(entry.username, row);
  }
  return [...tally.entries()]
    .filter(([, r]) => r.palpites >= minPalpites)
    .map(([username, r]) => ({ username, hits: r.hits, palpites: r.palpites, pct: r.hits / r.palpites }));
}

/**
 * The wall of shame: worst hit RATE, not worst raw error count — so 9 misses out
 * of 10 (10%) ranks below 9 out of 20 (55%). Ties go to the bigger sample: being
 * that cold across more palpites is the worse showing.
 */
export function worstAccuracyRanking(
  entries: VoteEntry[],
  byId: Record<string, MatchResult>,
  minPalpites = 10,
  cap = 5,
): AccuracyRow[] {
  return accuracyRows(entries, byId, minPalpites)
    .sort((a, b) => a.pct - b.pct || b.palpites - a.palpites || byName(a, b))
    .slice(0, cap);
}

/**
 * One sub's own hit rate — "sua % de acerto".
 *
 * Ungated on purpose: the shame/glory boards need a floor so a lone lucky guess
 * can't top them, but showing someone THEIR number is not a ranking, and hiding
 * it until their sixth palpite would just look broken. Null only when they have
 * no graded palpites at all, since 0-of-0 has no percentage to state.
 *
 * Case-insensitive: nicknames arrive from chat and from the form, and the same
 * person shouldn't read as two.
 */
export function userAccuracy(
  entries: VoteEntry[],
  byId: Record<string, MatchResult>,
  username: string | null,
): AccuracyRow | null {
  if (!username) return null;
  const want = username.trim().toLowerCase();
  if (!want) return null;
  let hits = 0;
  let palpites = 0;
  for (const { entry, home, away } of graded(entries, byId)) {
    if (entry.username.trim().toLowerCase() !== want) continue;
    if (entry.predHome === home && entry.predAway === away) hits += 1;
    palpites += 1;
  }
  if (palpites === 0) return null;
  return { username, hits, palpites, pct: hits / palpites };
}

/**
 * The mirror image: best hit RATE. Ties go to the bigger sample here too, for the
 * same reason read the other way — sustaining a rate over more palpites is the
 * better showing. The floor is lower than the shame board's (6 vs 10): being
 * accurate is rarer than being wrong, so demanding 10 would empty the board.
 */
export function bestAccuracyRanking(
  entries: VoteEntry[],
  byId: Record<string, MatchResult>,
  minPalpites = 6,
  cap = 5,
): AccuracyRow[] {
  return accuracyRows(entries, byId, minPalpites)
    .sort((a, b) => b.pct - a.pct || b.palpites - a.palpites || byName(a, b))
    .slice(0, cap);
}

export interface ChampionsBoard {
  /** The podium — humans only, already capped. */
  top: SubRank[];
  /** The house bot's row, shown as a benchmark rather than a competitor. */
  bot: SubRank | null;
  /** Whoever tops the human board. */
  champion: SubRank | null;
}

/**
 * Split an already-sorted ranking into the human podium and the house bot, so the
 * bot can be shown as "the score to beat" without ever occupying first place.
 */
export function championsBoard(ranks: SubRank[], cap = 10): ChampionsBoard {
  const bot = ranks.find((r) => isReservedName(r.username)) ?? null;
  const top = ranks.filter((r) => !isReservedName(r.username)).slice(0, cap);
  return { top, bot, champion: top[0] ?? null };
}
