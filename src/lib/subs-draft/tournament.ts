// Subs knockout — pure tournament logic (local-only spike, mocked).
//
// 32 drafted teams → a single-elimination bracket (16-avos → Oitavas → Quartas →
// Semis → Final). Each match's full result (goals + scorer timeline, and a penalty
// shootout when tied) is precomputed by `simulateMatch`; the UI reveals it minute
// by minute over the match clock. Team strength = the squad's average rating, so a
// better-drafted squad really does win more often.

import { CATS, COUNTRIES, BRACKET_SIZE, MOCK_SUBS, ROSTER, mockName, type Cat, type Player } from "./data";
import { emptyRoster, squadCount, type DraftState, type Team } from "./engine";
import { mulberry32, randInt32 } from "./prng";
import type { PlayerStatus, StatusMap } from "./squad";

/** A random stream in [0,1). Threaded through the sim so a match is a pure
 * function of its seed (see prng.ts). */
type Rng = () => number;

export const ROUND_NAMES = ["16-avos", "Oitavas", "Quartas", "Semis", "Final"];
export const FULL_TIME = 90; // simulated minutes per match

export type EventType = "goal" | "yellow" | "red" | "injury";

export interface MatchEvent {
  minute: number;
  teamId: string;
  type: EventType;
  player: string;
  playerId: string;
  /** Injury length, only for type === "injury". */
  out?: number | "cup";
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  /** Shootout tally when regulation ended level; null otherwise. */
  pens: { home: number; away: number } | null;
  winnerId: string;
}

export interface BracketMatch {
  id: string;
  round: number;
  slot: number;
  homeId: string | null;
  awayId: string | null;
  status: "pending" | "live" | "done";
  result: MatchResult | null;
}

/** rounds[r][slot] — round 0 = the 16-avos (16 matches). */
export type Bracket = BracketMatch[][];

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Average squad rating — a fallback team strength (defaults to ~78 if empty). */
export function teamStrength(team: Team): number {
  const all = CATS.flatMap((c) => team.roster[c]);
  if (all.length === 0) return 78;
  return all.reduce((s, p) => s + p.rating, 0) / all.length;
}

function avgRating(xi: Player[]): number {
  return xi.length ? xi.reduce((s, p) => s + p.rating, 0) / xi.length : 70;
}

/** Pick a random player from the XI, weighted by `weight(role)`. */
function pickWeighted(xi: Player[], weight: (c: Cat) => number, rng: Rng): Player | null {
  if (xi.length === 0) return null;
  const ws = xi.map((p) => weight(p.cat));
  const total = ws.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < xi.length; i++) {
    r -= ws[i];
    if (r <= 0) return xi[i];
  }
  return xi[0];
}

const SCORER_WEIGHT: Record<Cat, number> = { Atacante: 6, "Meio-campo": 3, Defensor: 1, Goleiro: 0.05 };
const CARD_WEIGHT: Record<Cat, number> = { Defensor: 3, "Meio-campo": 2.5, Atacante: 1.5, Goleiro: 0.6 };
const scorer = (xi: Player[], rng: Rng) => pickWeighted(xi, (c) => SCORER_WEIGHT[c], rng);
const carded = (xi: Player[], rng: Rng) => pickWeighted(xi, (c) => CARD_WEIGHT[c], rng);
const anyone = (xi: Player[], rng: Rng) => pickWeighted(xi, () => 1, rng);

/** Realistic-ish injury length: usually a match or two, rarely season-ending. */
function injuryLength(rng: Rng): number | "cup" {
  const r = rng();
  if (r < 0.06) return "cup";
  if (r < 0.22) return 3;
  if (r < 0.5) return 2;
  return 1;
}

/** Knuth's Poisson sampler — goal counts cluster realistically around λ. */
function poisson(lambda: number, rng: Rng): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

/** A best-effort shootout: each kick weighted by strength, first to a clear lead. */
function shootout(sh: number, sa: number, rng: Rng): { home: number; away: number } {
  const pH = 0.7 + 0.25 * (sh / (sh + sa));
  const pA = 0.7 + 0.25 * (sa / (sh + sa));
  let home = 0;
  let away = 0;
  for (let i = 0; i < 5; i++) {
    if (rng() < pH) home++;
    if (rng() < pA) away++;
  }
  while (home === away) {
    if (rng() < pH) home++;
    if (rng() < pA) away++;
  }
  return { home, away };
}

/**
 * Simulate a full knockout match from the two STARTING XIs — goals weighted by XI
 * strength (so lineup choices matter), plus yellow/red cards and injuries. Never a
 * draw: level ties go to penalties.
 */
export function simulateMatch(
  home: Team,
  away: Team,
  homeXI: Player[],
  awayXI: Player[],
  seed: number = randInt32(),
): MatchResult {
  const rng = mulberry32(seed);
  const sh = avgRating(homeXI);
  const sa = avgRating(awayXI);
  const total = sh + sa;
  const homeGoals = poisson(0.35 + 2.4 * (sh / total), rng);
  const awayGoals = poisson(0.35 + 2.4 * (sa / total), rng);

  const events: MatchEvent[] = [];
  const min = () => 1 + Math.floor(rng() * FULL_TIME);
  const goal = (teamId: string, xi: Player[], n: number) => {
    for (let i = 0; i < n; i++) {
      const p = scorer(xi, rng);
      if (p) events.push({ minute: min(), teamId, type: "goal", player: p.name, playerId: p.id });
    }
  };
  const cards = (teamId: string, xi: Player[]) => {
    const yellows = poisson(1.3, rng);
    for (let i = 0; i < yellows; i++) {
      const p = carded(xi, rng);
      if (p) events.push({ minute: min(), teamId, type: "yellow", player: p.name, playerId: p.id });
    }
    if (rng() < 0.08) {
      const p = carded(xi, rng);
      if (p) events.push({ minute: min(), teamId, type: "red", player: p.name, playerId: p.id });
    }
  };
  const injuries = (teamId: string, xi: Player[]) => {
    if (rng() < 0.2) {
      const p = anyone(xi, rng);
      if (p) events.push({ minute: min(), teamId, type: "injury", player: p.name, playerId: p.id, out: injuryLength(rng) });
    }
  };

  goal(home.id, homeXI, homeGoals);
  goal(away.id, awayXI, awayGoals);
  cards(home.id, homeXI);
  cards(away.id, awayXI);
  injuries(home.id, homeXI);
  injuries(away.id, awayXI);
  events.sort((a, b) => a.minute - b.minute);

  let pens: { home: number; away: number } | null = null;
  let winnerId: string;
  if (homeGoals === awayGoals) {
    pens = shootout(sh, sa, rng);
    winnerId = pens.home > pens.away ? home.id : away.id;
  } else {
    winnerId = homeGoals > awayGoals ? home.id : away.id;
  }
  return { homeGoals, awayGoals, events, pens, winnerId };
}

/* ── Player status across rounds: cards accumulate, suspensions/injuries decay ── */

/** A round passed — decrement everyone's ban/injury counters by one. */
export function advanceStatus(status: StatusMap): StatusMap {
  const next: StatusMap = {};
  for (const [id, s] of Object.entries(status)) {
    next[id] = { ...s, banRounds: Math.max(0, s.banRounds - 1), injuryRounds: Math.max(0, s.injuryRounds - 1) };
  }
  return next;
}

/** Fold a finished round's cards/injuries into the status map (bans apply next round). */
export function applyMatchEvents(status: StatusMap, events: MatchEvent[]): StatusMap {
  const next: StatusMap = {};
  for (const [id, s] of Object.entries(status)) next[id] = { ...s };
  const get = (id: string): PlayerStatus => (next[id] ??= { yellows: 0, banRounds: 0, injuryRounds: 0, injuredForCup: false });
  for (const e of events) {
    if (e.type === "yellow") {
      const s = get(e.playerId);
      s.yellows += 1;
      if (s.yellows >= 2) {
        s.yellows = 0;
        s.banRounds = Math.max(s.banRounds, 1);
      }
    } else if (e.type === "red") {
      get(e.playerId).banRounds = Math.max(get(e.playerId).banRounds, 1);
    } else if (e.type === "injury") {
      const s = get(e.playerId);
      if (e.out === "cup") s.injuredForCup = true;
      else if (typeof e.out === "number") s.injuryRounds = Math.max(s.injuryRounds, e.out);
    }
  }
  return next;
}

/** Build an empty bracket over a shuffled seeding of exactly 32 team ids. */
export function buildBracket(teamIds: string[], seed: number = randInt32()): Bracket {
  const seeded = shuffle(teamIds, mulberry32(seed));
  const rounds: Bracket = [];
  let size = BRACKET_SIZE; // teams in this round
  for (let r = 0; size >= 2; r++, size /= 2) {
    const matches: BracketMatch[] = [];
    for (let slot = 0; slot < size / 2; slot++) {
      matches.push({
        id: `r${r}-m${slot}`,
        round: r,
        slot,
        homeId: r === 0 ? seeded[slot * 2] : null,
        awayId: r === 0 ? seeded[slot * 2 + 1] : null,
        status: "pending",
        result: null,
      });
    }
    rounds.push(matches);
  }
  return rounds;
}

/** Place a finished match's winner into its parent slot in the next round. */
export function advanceWinner(bracket: Bracket, match: BracketMatch): void {
  const next = bracket[match.round + 1];
  if (!next || !match.result) return;
  const parent = next[Math.floor(match.slot / 2)];
  if (match.slot % 2 === 0) parent.homeId = match.result.winnerId;
  else parent.awayId = match.result.winnerId;
}

/** Deep-ish copy so callers never mutate a React-held bracket in place. */
function cloneBracket(bracket: Bracket): Bracket {
  return bracket.map((round) => round.map((m) => ({ ...m })));
}

/**
 * Immutably kick off a round: every match with both teams gets a simulated result
 * and goes `live`. Returns a NEW bracket; the input is untouched. `simulate` maps
 * two team ids to a result (lets the caller inject the team lookup).
 */
export function playRound(
  bracket: Bracket,
  idx: number,
  simulate: (homeId: string, awayId: string) => MatchResult,
): Bracket {
  return bracket.map((round, r) =>
    r !== idx
      ? round
      : round.map((m) =>
          m.homeId && m.awayId && !m.result ? { ...m, result: simulate(m.homeId, m.awayId), status: "live" as const } : m,
        ),
  );
}

/** Immutably finish a round: live matches → done, winners advance. Returns a NEW bracket. */
export function finishRound(bracket: Bracket, idx: number): Bracket {
  const next = cloneBracket(bracket);
  for (const m of next[idx]) {
    if (m.status === "live" && m.result) {
      m.status = "done";
      advanceWinner(next, m);
    }
  }
  return next;
}

/** The champion's team id once the final is done, else null. */
export function championId(bracket: Bracket): string | null {
  const final = bracket[bracket.length - 1]?.[0];
  return final?.status === "done" ? final.result?.winnerId ?? null : null;
}

/* ── Mock teams: flesh a short lobby out to a full 32-team bracket ── */

function mockSquad(seed: number): Team["roster"] {
  const roster = emptyRoster();
  let i = 0;
  for (const c of CATS) {
    const need = ROSTER[c];
    for (let n = 0; n < need; n++, i++) {
      roster[c].push({
        id: `mock-${seed}-${i}`,
        name: mockName(seed * 7 + i, seed * 3 + i * 5),
        cat: c,
        rating: 70 + ((seed * 13 + i * 17) % 24), // 70..93
        club: "—",
      });
    }
  }
  return roster;
}

/**
 * Return `teams` plus enough mock teams to reach 32, using countries and sub names
 * not already taken. Mock teams get a full auto-generated squad so they have a real
 * strength in the sim.
 */
export function fillTo32(teams: Team[]): Team[] {
  const out = [...teams];
  const usedCodes = new Set(teams.map((t) => t.code));
  const usedNames = new Set(teams.map((t) => t.owner.toLowerCase()));
  const freeCodes = COUNTRIES.filter((c) => !usedCodes.has(c));
  let ci = 0;
  let ni = 0;
  let seed = teams.length;
  while (out.length < BRACKET_SIZE && ci < freeCodes.length) {
    const code = freeCodes[ci++];
    let owner = MOCK_SUBS[ni % MOCK_SUBS.length];
    while (usedNames.has(owner.toLowerCase())) owner = `${MOCK_SUBS[ni % MOCK_SUBS.length]}${Math.floor(ni / MOCK_SUBS.length) + 2}`;
    ni++;
    usedNames.add(owner.toLowerCase());
    out.push({ id: `mt${seed}`, owner: `${owner} 🤖`, code, roster: mockSquad(seed) });
    seed++;
  }
  return out;
}

/** A fully mocked 32-team field (skips the lobby/draft entirely). */
export function mockField(): Team[] {
  return fillTo32([]);
}

/** Enter the knockout with the drafted teams, mock-filled up to 32. */
export function goToBracket(s: DraftState): DraftState {
  return { ...s, phase: "bracket", field: fillTo32(s.teams) };
}

/** Enter the knockout with a fully mocked 32-team field (skips lobby + draft). */
export function mockTournament(s: DraftState): DraftState {
  return { ...s, phase: "bracket", field: mockField() };
}

/** Whether a team is fully drafted (used to gate "ir para o mata-mata"). */
export function isComplete(team: Team): boolean {
  return squadCount(team) > 0;
}
