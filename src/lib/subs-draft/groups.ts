// Subs group stage — pure FIFA-2026 logic (local-only spike, no backend).
//
// 48 teams → a seeded draw into 12 groups of 4 → a round-robin → the top 2 of each
// group plus the 8 best third-placed teams = 32, which seed the existing knockout.
// Everything is a pure function of a seed (the A0 keystone) so a whole "Copa"
// replays identically. Draws are allowed (unlike the knockout); standings rank by
// points → goal difference → goals for → a deterministic seeded lot (FIFA's
// terminal "drawing of lots"; head-to-head mini-tables are a later refinement).

import { GROUP_COUNT, GROUP_SIZE, GROUP_TOTAL } from "./data";
import { mulberry32, randInt32 } from "./prng";
import { shuffle, type MatchResult } from "./tournament";

export type GroupName = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";
export const GROUP_NAMES: GroupName[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
export const MATCHDAY_NAMES = ["Rodada 1", "Rodada 2", "Rodada 3"];

export interface GroupMatch {
  id: string;
  matchday: 0 | 1 | 2;
  group: number; // 0..11
  slot: 0 | 1; // which of the two concurrent matches in the group this matchday
  homeId: string;
  awayId: string;
  status: "pending" | "live" | "done";
  result: MatchResult | null; // draws allowed → winnerId "" and pens null
}

export interface Group {
  name: GroupName;
  teamIds: string[]; // length 4
  matchdays: GroupMatch[][]; // length 3, each length 2
}

export interface TableRow {
  teamId: string;
  P: number;
  W: number;
  D: number;
  L: number;
  GF: number;
  GA: number;
  GD: number;
  Pts: number;
}

export interface GroupStage {
  seed: number;
  groups: Group[]; // length 12, A..L
}

/**
 * The round-robin schedule for a 4-team group as 3 matchdays of 2 concurrent
 * matches (circle method): MD1 0-1,2-3 · MD2 0-2,3-1 · MD3 0-3,1-2 — every pair
 * once, each team plays 3.
 */
const SCHEDULE: [number, number][][] = [
  [[0, 1], [2, 3]],
  [[0, 2], [3, 1]],
  [[0, 3], [1, 2]],
];

export function roundRobin(teamIds: string[], group: number): GroupMatch[][] {
  return SCHEDULE.map((md, mdi) =>
    md.map(([hi, ai], slot) => ({
      id: `g${group}-md${mdi}-s${slot}`,
      matchday: mdi as 0 | 1 | 2,
      group,
      slot: slot as 0 | 1,
      homeId: teamIds[hi],
      awayId: teamIds[ai],
      status: "pending" as const,
      result: null,
    })),
  );
}

/** Seeded draw of exactly 48 team ids into 12 groups of 4. */
export function drawGroups(teamIds: string[], seed: number = randInt32()): GroupStage {
  if (teamIds.length !== GROUP_TOTAL) {
    throw new Error(`drawGroups needs exactly ${GROUP_TOTAL} teams, got ${teamIds.length}`);
  }
  const shuffled = shuffle(teamIds, mulberry32(seed));
  const groups: Group[] = [];
  for (let g = 0; g < GROUP_COUNT; g++) {
    const slice = shuffled.slice(g * GROUP_SIZE, g * GROUP_SIZE + GROUP_SIZE);
    groups.push({ name: GROUP_NAMES[g], teamIds: slice, matchdays: roundRobin(slice, g) });
  }
  return { seed, groups };
}

/** A stable per-match seed derived from the stage seed + its coordinates. */
export function groupMatchSeed(stageSeed: number, g: number, md: number, slot: number): number {
  return (mulberry32((stageSeed + g * 100003 + md * 1009 + slot * 31) >>> 0)() * 4294967296) >>> 0;
}

/* ── standings ─────────────────────────────────────────────────────────────── */

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** A deterministic 0..1 lot for a team under a stage seed (the terminal tiebreak). */
function lot(seed: number, teamId: string): number {
  return mulberry32((seed + strHash(teamId)) >>> 0)();
}

/** FIFA order: points → goal diff → goals for → seeded lot → id (total order). */
function rank(a: TableRow, b: TableRow, seed: number): number {
  return (
    b.Pts - a.Pts ||
    b.GD - a.GD ||
    b.GF - a.GF ||
    lot(seed, a.teamId) - lot(seed, b.teamId) ||
    (a.teamId < b.teamId ? -1 : 1)
  );
}

/** The group table from its FINISHED matches, sorted (best first). */
export function standings(group: Group, seed: number): TableRow[] {
  const rows = new Map<string, TableRow>();
  for (const id of group.teamIds) rows.set(id, { teamId: id, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 });
  for (const m of group.matchdays.flat()) {
    if (m.status !== "done" || !m.result) continue;
    const h = rows.get(m.homeId);
    const a = rows.get(m.awayId);
    if (!h || !a) continue;
    const hg = m.result.homeGoals;
    const ag = m.result.awayGoals;
    h.P += 1; a.P += 1;
    h.GF += hg; h.GA += ag; a.GF += ag; a.GA += hg;
    if (hg > ag) { h.W += 1; h.Pts += 3; a.L += 1; }
    else if (hg < ag) { a.W += 1; a.Pts += 3; h.L += 1; }
    else { h.D += 1; a.D += 1; h.Pts += 1; a.Pts += 1; }
  }
  const out = [...rows.values()];
  for (const r of out) r.GD = r.GF - r.GA;
  return out.sort((a, b) => rank(a, b, seed));
}

/** The 8 best third-placed teams across the 12 groups (pts → GD → GF → seeded lot). */
export function bestThirds(stage: GroupStage): TableRow[] {
  const thirds = stage.groups.map((g) => standings(g, stage.seed)[2]);
  return thirds.sort((a, b) => rank(a, b, stage.seed)).slice(0, 8);
}

/** The 32 knockout qualifiers: 12 winners, 12 runners-up, 8 best thirds. */
export function qualified32(stage: GroupStage): string[] {
  const firsts = stage.groups.map((g) => standings(g, stage.seed)[0].teamId);
  const seconds = stage.groups.map((g) => standings(g, stage.seed)[1].teamId);
  const thirds = bestThirds(stage).map((r) => r.teamId);
  return [...firsts, ...seconds, ...thirds];
}

/* ── immutable playback transitions (mirror playRound/finishRound) ───────────── */

/** Simulate one matchday's matches across all groups (pending → live + result). */
export function playMatchday(stage: GroupStage, mdIdx: number, sim: (m: GroupMatch) => MatchResult): GroupStage {
  return {
    ...stage,
    groups: stage.groups.map((g) => ({
      ...g,
      matchdays: g.matchdays.map((md, i) =>
        i !== mdIdx ? md : md.map((m) => (m.status === "pending" ? { ...m, status: "live" as const, result: sim(m) } : m)),
      ),
    })),
  };
}

/** Close a matchday (live → done) so its results count toward the standings. */
export function finishMatchday(stage: GroupStage, mdIdx: number): GroupStage {
  return {
    ...stage,
    groups: stage.groups.map((g) => ({
      ...g,
      matchdays: g.matchdays.map((md, i) =>
        i !== mdIdx ? md : md.map((m) => (m.status === "live" ? { ...m, status: "done" as const } : m)),
      ),
    })),
  };
}
