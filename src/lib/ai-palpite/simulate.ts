import {
  isPlaceholderTeam,
  type Group,
  type Match,
  type StandingRow,
} from "@/lib/espn";
import { teamPower } from "@/lib/ai-palpite/power";
import { predictScore, strongerCode } from "@/lib/ai-palpite/predict";

/**
 * Full mata-mata simulation. From the live group tables + the remaining group
 * fixtures I project every group's final 1–4, pick + allocate the eight best
 * third places, resolve all 16 round-of-32 ties to concrete teams, then play the
 * bracket forward — oitavas → final (+ 3º lugar) — to a champion. Deterministic:
 * the same input always yields the same bracket (power ratings, no randomness).
 *
 * The bracket wiring is FIFA's fixed 2026 structure, confirmed against ESPN's own
 * slot placeholders ("Round of 32 1 Winner", etc.). Round-of-32 slots are
 * numbered 1–16 by kickoff order — the only deterministic signal ESPN exposes.
 */

export interface SimTeam {
  code: string;
  name: string;
  /** True when this side is my prediction (group position / third place) rather
   *  than a team already decided on the pitch. */
  projected: boolean;
}

export interface SimTie {
  id: string;
  home: SimTeam;
  away: SimTeam;
  homeGoals: number;
  awayGoals: number;
  winner: "home" | "away";
  /** Predicted level after 90' → I resolve it on penalties (stronger side). */
  penalties: boolean;
}

export interface SimColumn {
  slug: string;
  label: string;
  ties: SimTie[];
}

export interface BracketSim {
  /** Ordered columns: 32-avos, Oitavas, Quartas, Semifinais, Final. */
  columns: SimColumn[];
  /** Disputa de 3º lugar (semifinal losers), or null if not simulable. */
  thirdPlace: SimTie | null;
  champion: SimTeam | null;
  runnerUp: SimTeam | null;
  third: SimTeam | null;
}

interface Standing {
  code: string;
  name: string;
  points: number;
  gd: number;
  power: number;
}

const STAGE_LABEL: Record<string, string> = {
  "round-of-32": "32-avos",
  "round-of-16": "Oitavas",
  quarterfinals: "Quartas",
  semifinals: "Semifinais",
  final: "Final",
};

// R16 home/away by round-of-32 winner number (1–16); QF by R16 winner number
// (1–8); SF by QF winner number (1–4); final/3rd by SF number (1–2). Read off
// ESPN's slot placeholders — see module header.
const R16_FROM_R32: [number, number][] = [
  [1, 3], [2, 5], [4, 6], [7, 8], [11, 12], [9, 10], [14, 16], [13, 15],
];
const QF_FROM_R16: [number, number][] = [[1, 2], [5, 6], [3, 4], [7, 8]];
const SF_FROM_QF: [number, number][] = [[1, 2], [3, 4]];

function parseGd(gd: string): number {
  const n = Number(gd);
  return Number.isFinite(n) ? n : 0;
}

function cmpStanding(a: Standing, b: Standing): number {
  return (
    b.points - a.points ||
    b.gd - a.gd ||
    b.power - a.power ||
    a.code.localeCompare(b.code)
  );
}

/** Project a group's final 1–4 by playing out its remaining fixtures. */
function projectGroup(rows: StandingRow[], remaining: Match[]): Standing[] {
  const table = new Map<string, Standing>();
  for (const r of rows) {
    table.set(r.code, {
      code: r.code,
      name: r.name,
      points: r.points,
      gd: parseGd(r.gd),
      power: teamPower(r.code),
    });
  }
  for (const m of remaining) {
    const h = table.get(m.home.abbreviation);
    const a = table.get(m.away.abbreviation);
    if (!h || !a) continue;
    const s = predictScore(h.power, a.power);
    h.gd += s.home - s.away;
    a.gd += s.away - s.home;
    if (s.winner === "home") h.points += 3;
    else if (s.winner === "away") a.points += 3;
    else {
      h.points += 1;
      a.points += 1;
    }
  }
  return [...table.values()].sort(cmpStanding);
}

interface ThirdSlot {
  key: string; // matchId + side
  allowed: string[];
}

function slotKey(matchId: string, side: "home" | "away"): string {
  return `${matchId}:${side}`;
}

/**
 * Allocate the eight best third places to the eight "Third Place Group X/Y/…"
 * slots ESPN exposes, honoring each slot's allowed-group set. Maximum bipartite
 * matching (Kuhn's), strongest thirds first, so the allocation is both valid and
 * deterministic; any slot left unmatched is back-filled with the next best third.
 */
function allocateThirds(
  slots: ThirdSlot[],
  thirds: { letter: string; standing: Standing }[],
): Map<string, Standing> {
  const thirdOfSlot: number[] = new Array(slots.length).fill(-1);

  function augment(ti: number, seen: boolean[]): boolean {
    for (let si = 0; si < slots.length; si++) {
      if (seen[si] || !slots[si].allowed.includes(thirds[ti].letter)) continue;
      seen[si] = true;
      if (thirdOfSlot[si] === -1 || augment(thirdOfSlot[si], seen)) {
        thirdOfSlot[si] = ti;
        return true;
      }
    }
    return false;
  }

  // Thirds arrive ranked best-first; process in that order so strong sides land.
  for (let ti = 0; ti < thirds.length; ti++) {
    augment(ti, new Array(slots.length).fill(false));
  }

  const out = new Map<string, Standing>();
  const usedThirds = new Set<number>();
  for (let si = 0; si < slots.length; si++) {
    if (thirdOfSlot[si] !== -1) {
      out.set(slots[si].key, thirds[thirdOfSlot[si]].standing);
      usedThirds.add(thirdOfSlot[si]);
    }
  }
  // Back-fill any slot the matching couldn't fill (shouldn't happen with the
  // real allowed-sets) with the best still-unused third.
  const leftovers = thirds.map((_, i) => i).filter((i) => !usedThirds.has(i));
  for (let si = 0; si < slots.length; si++) {
    if (!out.has(slots[si].key) && leftovers.length) {
      out.set(slots[si].key, thirds[leftovers.shift()!].standing);
    }
  }
  return out;
}

function teamFromStanding(s: Standing): SimTeam {
  return { code: s.code, name: s.name, projected: true };
}

function playTie(id: string, home: SimTeam, away: SimTeam): SimTie {
  const s = predictScore(teamPower(home.code), teamPower(away.code));
  let winner: "home" | "away";
  let penalties = false;
  if (s.winner === "draw") {
    penalties = true;
    winner = strongerCode(home.code, away.code) === home.code ? "home" : "away";
  } else {
    winner = s.winner;
  }
  return { id, home, away, homeGoals: s.home, awayGoals: s.away, winner, penalties };
}

const winnerOf = (t: SimTie): SimTeam => (t.winner === "home" ? t.home : t.away);
const loserOf = (t: SimTie): SimTeam => (t.winner === "home" ? t.away : t.home);

const EMPTY: BracketSim = {
  columns: [],
  thirdPlace: null,
  champion: null,
  runnerUp: null,
  third: null,
};

/** Build the full projected bracket from live fixtures + standings. */
export function simulateBracket(matches: Match[], groups: Group[]): BracketSim {
  const r32 = matches
    .filter((m) => m.stage === "round-of-32")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (r32.length !== 16 || groups.length === 0) return EMPTY;

  // Project every group's final order.
  const groupOf = new Map<string, string>();
  for (const g of groups) for (const r of g.rows) groupOf.set(r.code, g.letter);
  const remByGroup = new Map<string, Match[]>();
  for (const m of matches) {
    if (m.stage !== "group-stage" || m.state === "post") continue;
    const letter = groupOf.get(m.home.abbreviation);
    if (!letter) continue;
    const arr = remByGroup.get(letter) ?? [];
    arr.push(m);
    remByGroup.set(letter, arr);
  }
  const standings = new Map<string, Standing[]>();
  for (const g of groups) {
    standings.set(g.letter, projectGroup(g.rows, remByGroup.get(g.letter) ?? []));
  }

  // Teams ESPN has already placed into the bracket (decided slots). A third place
  // that's already slotted here must NOT be re-allocated to an open "Third Place
  // Group …" seed, or it would appear twice.
  const placed = new Set<string>();
  for (const m of r32) {
    for (const t of [m.home, m.away]) {
      if (!isPlaceholderTeam(t.name)) placed.add(t.abbreviation);
    }
  }

  // Rank the still-open third places and gather the third-place slots from the
  // R32 fixtures. Each group contributes its projected third unless that side is
  // already placed elsewhere.
  const thirds = [...standings.entries()]
    .map(([letter, table]) => ({ letter, standing: table[2] }))
    .filter((t) => t.standing != null && !placed.has(t.standing.code))
    .sort((a, b) => cmpStanding(a.standing, b.standing));

  const thirdSlots: ThirdSlot[] = [];
  const sideOf = (m: Match, side: "home" | "away") => (side === "home" ? m.home : m.away);
  for (const m of r32) {
    for (const side of ["home", "away"] as const) {
      const team = sideOf(m, side);
      const tp = team.name.match(/Third Place Group ([A-L/]+)/i);
      if (tp) thirdSlots.push({ key: slotKey(m.id, side), allowed: tp[1].split("/") });
    }
  }
  const thirdAssign = allocateThirds(thirdSlots, thirds);

  function resolve(m: Match, side: "home" | "away"): SimTeam {
    const team = sideOf(m, side);
    if (!isPlaceholderTeam(team.name)) {
      return { code: team.abbreviation, name: team.name, projected: false };
    }
    const winner = team.name.match(/Group ([A-L]) Winner/i);
    const place = team.name.match(/Group ([A-L]) (\d+)(?:st|nd|rd|th) Place/i);
    if (winner) {
      const s = standings.get(winner[1].toUpperCase())?.[0];
      if (s) return teamFromStanding(s);
    } else if (place) {
      const s = standings.get(place[1].toUpperCase())?.[Number(place[2]) - 1];
      if (s) return teamFromStanding(s);
    } else if (/Third Place/i.test(team.name)) {
      const s = thirdAssign.get(slotKey(m.id, side));
      if (s) return teamFromStanding(s);
    }
    // Unresolved seed — keep its short code so the slot still renders.
    return { code: team.abbreviation, name: team.name, projected: true };
  }

  // Round of 32, numbered 1–16 by kickoff order.
  const r32Ties = r32.map((m, i) => playTie(`r32-${i + 1}`, resolve(m, "home"), resolve(m, "away")));
  const pick = (ties: SimTie[], pairs: [number, number][], slug: string) =>
    pairs.map(([h, a], i) => playTie(`${slug}-${i + 1}`, winnerOf(ties[h - 1]), winnerOf(ties[a - 1])));

  const r16Ties = pick(r32Ties, R16_FROM_R32, "r16");
  const qfTies = pick(r16Ties, QF_FROM_R16, "qf");
  const sfTies = pick(qfTies, SF_FROM_QF, "sf");
  const finalTie = playTie("final", winnerOf(sfTies[0]), winnerOf(sfTies[1]));
  const thirdPlace = playTie("third", loserOf(sfTies[0]), loserOf(sfTies[1]));

  const columns: SimColumn[] = [
    { slug: "round-of-32", label: STAGE_LABEL["round-of-32"], ties: r32Ties },
    { slug: "round-of-16", label: STAGE_LABEL["round-of-16"], ties: r16Ties },
    { slug: "quarterfinals", label: STAGE_LABEL.quarterfinals, ties: qfTies },
    { slug: "semifinals", label: STAGE_LABEL.semifinals, ties: sfTies },
    { slug: "final", label: STAGE_LABEL.final, ties: [finalTie] },
  ];

  return {
    columns,
    thirdPlace,
    champion: winnerOf(finalTie),
    runnerUp: loserOf(finalTie),
    third: winnerOf(thirdPlace),
  };
}
