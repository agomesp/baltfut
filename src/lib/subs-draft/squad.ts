// Squad management — formations, starting XI / bench, and player availability
// (cards + injuries). Pure; shared by the draft, the tournament sim and the pitch.

import { CATS, type Cat, type Player } from "./data";
import type { Team } from "./engine";

/* ─────────────── Formations ─────────────── */

export interface Formation {
  name: string;
  def: number;
  mid: number;
  atk: number;
}

export const FORMATIONS: Formation[] = [
  { name: "4-4-2", def: 4, mid: 4, atk: 2 },
  { name: "4-3-3", def: 4, mid: 3, atk: 3 },
  { name: "3-5-2", def: 3, mid: 5, atk: 2 },
  { name: "5-3-2", def: 5, mid: 3, atk: 2 },
  { name: "4-2-3-1", def: 4, mid: 5, atk: 1 },
  { name: "3-4-3", def: 3, mid: 4, atk: 3 },
];
export const DEFAULT_FORMATION = "4-4-2";

export function formationByName(name: string): Formation {
  return FORMATIONS.find((f) => f.name === name) ?? FORMATIONS[0];
}

/** Starters needed per category for a formation (GK always 1). */
export function catNeed(f: Formation): Record<Cat, number> {
  return { Goleiro: 1, Defensor: f.def, "Meio-campo": f.mid, Atacante: f.atk };
}

/* ─────────────── Player availability (cards + injuries) ─────────────── */

export interface PlayerStatus {
  /** Yellow cards accrued so far (2 → a one-match ban, then resets). */
  yellows: number;
  /** Upcoming rounds the player is suspended for. */
  banRounds: number;
  /** Upcoming rounds out injured (0 = fit). */
  injuryRounds: number;
  /** Season-ending injury — out for the rest of the cup. */
  injuredForCup: boolean;
}

export type StatusMap = Record<string, PlayerStatus>;

export function available(status: StatusMap, id: string): boolean {
  const s = status[id];
  return !s || (s.banRounds <= 0 && s.injuryRounds <= 0 && !s.injuredForCup);
}

/** Short why-unavailable label, or null when fit. */
export function unavailableLabel(s?: PlayerStatus): string | null {
  if (!s) return null;
  if (s.injuredForCup) return "🚑 fora da copa";
  if (s.injuryRounds > 0) return `🚑 lesão (${s.injuryRounds})`;
  if (s.banRounds > 0) return "🟥 suspenso";
  return null;
}

/* ─────────────── Lineups (the starting XI) ─────────────── */

export interface Lineup {
  formation: string;
  gk: string | null;
  def: string[];
  mid: string[];
  atk: string[];
}

const CAT_OF: Record<Cat, keyof Omit<Lineup, "formation">> = {
  Goleiro: "gk",
  Defensor: "def",
  "Meio-campo": "mid",
  Atacante: "atk",
};

/** All 11 starter ids in one list. */
export function starterIds(l: Lineup): string[] {
  return [l.gk, ...l.def, ...l.mid, ...l.atk].filter((x): x is string => x != null);
}

/** Best AVAILABLE players of a category, highest-rated first. */
function bestOf(team: Team, cat: Cat, status: StatusMap, exclude: Set<string>): Player[] {
  return team.roster[cat]
    .filter((p) => available(status, p.id) && !exclude.has(p.id))
    .sort((a, b) => b.rating - a.rating);
}

/** Auto-pick the strongest legal XI for a formation, respecting availability. */
export function autoLineup(team: Team, formationName: string, status: StatusMap): Lineup {
  const f = formationByName(formationName);
  const need = catNeed(f);
  const used = new Set<string>();
  const take = (cat: Cat, n: number): string[] => {
    const got = bestOf(team, cat, status, used).slice(0, n).map((p) => p.id);
    got.forEach((id) => used.add(id));
    return got;
  };
  const gk = take("Goleiro", 1)[0] ?? null;
  const lineup: Lineup = {
    formation: formationName,
    gk,
    def: take("Defensor", need.Defensor),
    mid: take("Meio-campo", need["Meio-campo"]),
    atk: take("Atacante", need.Atacante),
  };
  return fillShort(team, lineup, status, used);
}

/** If a line is short on available players, top the XI up to 11 from any fit player. */
function fillShort(team: Team, lineup: Lineup, status: StatusMap, used: Set<string>): Lineup {
  const want = catNeed(formationByName(lineup.formation));
  const lines: [keyof Omit<Lineup, "formation">, Cat][] = [
    ["def", "Defensor"], ["mid", "Meio-campo"], ["atk", "Atacante"],
  ];
  for (const [key, primary] of lines) {
    const arr = lineup[key] as string[];
    const missing = want[primary] - arr.length;
    for (let i = 0; i < missing; i++) {
      const spare = CATS.flatMap((c) => bestOf(team, c, status, used)).sort((a, b) => b.rating - a.rating)[0];
      if (!spare) break;
      arr.push(spare.id);
      used.add(spare.id);
    }
  }
  if (!lineup.gk) {
    const anyKeeper = bestOf(team, "Goleiro", status, used)[0] ?? CATS.flatMap((c) => bestOf(team, c, status, used))[0];
    if (anyKeeper) {
      lineup.gk = anyKeeper.id;
      used.add(anyKeeper.id);
    }
  }
  return lineup;
}

/**
 * Keep a (possibly hand-edited) lineup valid: drop now-unavailable players and any
 * over-the-limit picks for the formation, then auto-fill the gaps with the best fit
 * players. Manual choices survive where they still make sense.
 */
export function repairLineup(team: Team, lineup: Lineup | undefined, status: StatusMap): Lineup {
  if (!lineup) return autoLineup(team, DEFAULT_FORMATION, status);
  const f = formationByName(lineup.formation);
  const need = catNeed(f);
  const inSquad = new Set(CATS.flatMap((c) => team.roster[c].map((p) => p.id)));
  const used = new Set<string>();
  const keep = (ids: (string | null)[], cat: Cat, n: number): string[] => {
    const out: string[] = [];
    for (const id of ids) {
      if (out.length >= n) break;
      if (id && inSquad.has(id) && available(status, id) && !used.has(id) && team.roster[cat].some((p) => p.id === id)) {
        out.push(id);
        used.add(id);
      }
    }
    return out;
  };
  const gkKept = keep([lineup.gk], "Goleiro", 1);
  let next: Lineup = {
    formation: lineup.formation,
    gk: gkKept[0] ?? null,
    def: keep(lineup.def, "Defensor", need.Defensor),
    mid: keep(lineup.mid, "Meio-campo", need["Meio-campo"]),
    atk: keep(lineup.atk, "Atacante", need.Atacante),
  };
  // top up any line the kept picks left short
  const fillCat = (cat: Cat, key: keyof Omit<Lineup, "formation">, n: number) => {
    const arr = next[key] as string[];
    for (const p of bestOf(team, cat, status, used)) {
      if (arr.length >= n) break;
      arr.push(p.id);
      used.add(p.id);
    }
    if (key === "gk" && !next.gk && arr.length === 0) {
      const k = bestOf(team, "Goleiro", status, used)[0];
      if (k) { next.gk = k.id; used.add(k.id); }
    }
  };
  if (!next.gk) {
    const k = bestOf(team, "Goleiro", status, used)[0];
    if (k) { next.gk = k.id; used.add(k.id); }
  }
  fillCat("Defensor", "def", need.Defensor);
  fillCat("Meio-campo", "mid", need["Meio-campo"]);
  fillCat("Atacante", "atk", need.Atacante);
  next = fillShort(team, next, status, used);
  return next;
}

/** Toggle a player in/out of the XI for their category, honoring the formation cap. */
export function toggleStarter(team: Team, lineup: Lineup, playerId: string): Lineup {
  const player = CATS.flatMap((c) => team.roster[c]).find((p) => p.id === playerId);
  if (!player) return lineup;
  const key = CAT_OF[player.cat];
  const need = catNeed(formationByName(lineup.formation));
  const cap = player.cat === "Goleiro" ? 1 : need[player.cat];
  if (key === "gk") {
    return { ...lineup, gk: lineup.gk === playerId ? null : playerId };
  }
  const arr = lineup[key] as string[];
  if (arr.includes(playerId)) return { ...lineup, [key]: arr.filter((id) => id !== playerId) };
  if (arr.length >= cap) return lineup; // line full — deselect another first
  return { ...lineup, [key]: [...arr, playerId] };
}

const byId = (team: Team) => {
  const m = new Map<string, Player>();
  CATS.forEach((c) => team.roster[c].forEach((p) => m.set(p.id, p)));
  return m;
};

export function startingPlayers(team: Team, lineup: Lineup): Player[] {
  const m = byId(team);
  return starterIds(lineup).map((id) => m.get(id)).filter((p): p is Player => p != null);
}

export function benchPlayers(team: Team, lineup: Lineup, status: StatusMap): Player[] {
  const starters = new Set(starterIds(lineup));
  return CATS.flatMap((c) => team.roster[c])
    .filter((p) => !starters.has(p.id) && available(status, p.id));
}

/** Average rating of the starters present — the team's match strength. */
export function lineupStrength(team: Team, lineup: Lineup): number {
  const xi = startingPlayers(team, lineup);
  if (xi.length === 0) return 70;
  return xi.reduce((s, p) => s + p.rating, 0) / xi.length;
}

/* ─────────────── Pitch layout from a formation ─────────────── */

export interface FieldSlot { id: string; name: string; role: Cat; x: number; y: number; rating: number }

const BAND: Record<Cat, number> = { Goleiro: 8, Defensor: 25, "Meio-campo": 46, Atacante: 64 };

function spread(count: number, i: number): number {
  return count <= 1 ? 50 : 16 + (i * 68) / (count - 1);
}

/** Lay the XI out on the pitch (x = width 0..100, y = length 0..100 toward attack). */
export function fieldLayout(team: Team, lineup: Lineup, side: "home" | "away"): FieldSlot[] {
  const m = byId(team);
  const out: FieldSlot[] = [];
  const place = (ids: string[], role: Cat) => {
    ids.forEach((id, i) => {
      const p = m.get(id);
      if (!p) return;
      const yBand = BAND[role];
      out.push({ id, name: p.name, role, x: spread(ids.length, i), y: side === "home" ? yBand : 100 - yBand, rating: p.rating });
    });
  };
  if (lineup.gk) place([lineup.gk], "Goleiro");
  place(lineup.def, "Defensor");
  place(lineup.mid, "Meio-campo");
  place(lineup.atk, "Atacante");
  return out;
}
