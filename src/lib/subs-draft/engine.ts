// Subs draft engine — pure state transitions (local-only spike, no backend).
//
// The game, per the spec:
//   1) LOBBY — subs register a team: a name + a country. First to claim a country
//      gets it (countries are unique).
//   2) DRAFT — once started, the category priority (Goleiro / Defensor / …) is
//      shuffled, and a draft order (lottery) over the teams is shuffled. Then,
//      category by category, each team picks one player of that category in draft
//      order; when every team has its quota for the category, the next category
//      starts back at team #1. A team that doesn't pick when on the clock is sent
//      to the BOTTOM of the current round's queue (delayed, not skipped forever).
//   3) DONE — every team's squad is full. Matches + bracket are mocked later.

import { CATS, COUNTRIES, MOCK_SUBS, ROSTER, PLAYER_POOL, type Cat, type Player } from "./data";

export interface Team {
  id: string;
  owner: string;
  code: string; // FIFA country code
  roster: Record<Cat, Player[]>;
}

export type Phase = "lobby" | "draft" | "done" | "groups" | "bracket";

export interface DraftState {
  phase: Phase;
  teams: Team[];
  /** Team ids in draft priority (the lottery order). */
  order: string[];
  /** Randomized category priority. */
  catOrder: Cat[];
  /** Index into catOrder. */
  catIdx: number;
  /** Which copy of the current category (0..ROSTER[cat]-1). */
  roundInCat: number;
  /** Team ids still to pick this round; head = on the clock. */
  queue: string[];
  /** Players still available. */
  pool: Player[];
  /** Newest-first activity log. */
  log: string[];
  /** The 32-team field for the knockout (set when entering the bracket phase). */
  field: Team[];
}

export function emptyRoster(): Record<Cat, Player[]> {
  return { Goleiro: [], Defensor: [], "Meio-campo": [], Atacante: [] };
}

export function initialState(): DraftState {
  return {
    phase: "lobby",
    teams: [],
    order: [],
    catOrder: [],
    catIdx: 0,
    roundInCat: 0,
    queue: [],
    pool: [],
    log: [],
    field: [],
  };
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Register a team. Country is first-come: a taken code is rejected (no-op). */
export function addTeam(s: DraftState, owner: string, code: string): DraftState {
  if (s.phase !== "lobby") return s;
  const name = owner.trim();
  if (!name || s.teams.some((t) => t.code === code)) return s;
  const team: Team = { id: `t${s.teams.length + 1}`, owner: name, code, roster: emptyRoster() };
  return { ...s, teams: [...s.teams, team] };
}

export function removeTeam(s: DraftState, id: string): DraftState {
  if (s.phase !== "lobby") return s;
  return { ...s, teams: s.teams.filter((t) => t.id !== id) };
}

/** Lock the lobby and roll the draft (needs ≥ 2 teams). */
export function startDraft(s: DraftState): DraftState {
  if (s.phase !== "lobby" || s.teams.length < 2) return s;
  const order = shuffle(s.teams.map((t) => t.id));
  const catOrder = shuffle(CATS);
  const ord = order.map((id, i) => `#${i + 1} ${teamLabel(s, id)}`).join("  ");
  return {
    ...s,
    phase: "draft",
    order,
    catOrder,
    catIdx: 0,
    roundInCat: 0,
    queue: [...order],
    pool: [...PLAYER_POOL],
    log: [
      `Categorias sorteadas: ${catOrder.join(" → ")}`,
      `Ordem do draft: ${ord}`,
      "Draft iniciado · Dia 1",
    ],
  };
}

export function currentCat(s: DraftState): Cat | null {
  return s.phase === "draft" ? s.catOrder[s.catIdx] ?? null : null;
}

export function onClockTeamId(s: DraftState): string | null {
  return s.phase === "draft" ? s.queue[0] ?? null : null;
}

export function pickNumber(s: DraftState, teamId: string): number {
  return s.order.indexOf(teamId) + 1;
}

function teamLabel(s: DraftState, id: string): string {
  const t = s.teams.find((x) => x.id === id);
  return t ? `${t.owner} (${t.code})` : id;
}

/** Players of the category currently being drafted, still available. */
export function availableForCurrent(s: DraftState): Player[] {
  const cat = currentCat(s);
  if (!cat) return [];
  return s.pool.filter((p) => p.cat === cat);
}

/** The round just emptied → step to the next round / category / done. */
function advanceRound(s: DraftState): DraftState {
  const cat = s.catOrder[s.catIdx];
  if (s.roundInCat + 1 < ROSTER[cat]) {
    return { ...s, roundInCat: s.roundInCat + 1, queue: [...s.order] };
  }
  const nextIdx = s.catIdx + 1;
  if (nextIdx >= s.catOrder.length) {
    return { ...s, phase: "done", queue: [], log: ["Draft completo — todos os times montados!", ...s.log] };
  }
  return { ...s, catIdx: nextIdx, roundInCat: 0, queue: [...s.order] };
}

/** The team on the clock drafts a player (must match the current category). */
export function pick(s: DraftState, playerId: string): DraftState {
  if (s.phase !== "draft") return s;
  const teamId = s.queue[0];
  const cat = currentCat(s);
  if (!teamId || !cat) return s;
  const p = s.pool.find((x) => x.id === playerId && x.cat === cat);
  if (!p) return s;

  const teams = s.teams.map((t) =>
    t.id === teamId ? { ...t, roster: { ...t.roster, [cat]: [...t.roster[cat], p] } } : t,
  );
  const next: DraftState = {
    ...s,
    teams,
    pool: s.pool.filter((x) => x.id !== playerId),
    queue: s.queue.slice(1),
    log: [`#${pickNumber(s, teamId)} ${teamLabel(s, teamId)} escolheu ${p.name} · ${cat}`, ...s.log],
  };
  return next.queue.length === 0 ? advanceRound(next) : next;
}

/** On-the-clock team passes → moved to the bottom of the current round (delayed). */
export function skip(s: DraftState): DraftState {
  if (s.phase !== "draft" || s.queue.length < 2) return s; // last in queue must pick
  const teamId = s.queue[0];
  return {
    ...s,
    queue: [...s.queue.slice(1), teamId],
    log: [`#${pickNumber(s, teamId)} ${teamLabel(s, teamId)} passou — vai pro fim da fila`, ...s.log],
  };
}

/** Auto-pick the highest-rated available player for the team on the clock. */
export function autoPick(s: DraftState): DraftState {
  const best = [...availableForCurrent(s)].sort((a, b) => b.rating - a.rating)[0];
  return best ? pick(s, best.id) : s;
}

/**
 * Auto-pick with a little randomness — weighted toward the best of the top few
 * available. Used by the live draft simulation so picks vary instead of always
 * taking the single best player.
 */
export function autoPickWeighted(s: DraftState): DraftState {
  const top = [...availableForCurrent(s)].sort((a, b) => b.rating - a.rating).slice(0, 5);
  if (top.length === 0) return s;
  const weights = top.map((p) => p.rating ** 3);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let chosen = top[0];
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      chosen = top[i];
      break;
    }
  }
  return pick(s, chosen.id);
}

/** Fill the lobby with mock "bot" subs (empty rosters) up to `target` teams. */
export function addBots(s: DraftState, target: number): DraftState {
  if (s.phase !== "lobby") return s;
  let st = s;
  let ni = 0;
  for (const code of COUNTRIES) {
    if (st.teams.length >= target) break;
    if (st.teams.some((t) => t.code === code)) continue;
    const owner = `${MOCK_SUBS[ni % MOCK_SUBS.length]}${ni >= MOCK_SUBS.length ? Math.floor(ni / MOCK_SUBS.length) + 1 : ""} 🤖`;
    ni++;
    st = addTeam(st, owner, code);
  }
  return st;
}

export function squadCount(t: Team): number {
  return CATS.reduce((n, c) => n + t.roster[c].length, 0);
}
