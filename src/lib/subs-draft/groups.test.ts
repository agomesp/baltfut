// The group stage — pure FIFA-2026 logic: a seeded draw into 12 groups of 4, a
// round-robin, standings (Pts→GD→GF→seeded lot), and the 24 group-winners/runners
// + 8 best third-placed teams that fill the 32-team knockout. Deterministic from a
// seed (the A0 keystone), so a whole "Copa" replays identically.
import { describe, it, expect } from "vitest";
import {
  drawGroups,
  roundRobin,
  standings,
  bestThirds,
  qualified32,
  groupMatchSeed,
  playMatchday,
  finishMatchday,
  GROUP_NAMES,
  type Group,
  type GroupMatch,
} from "./groups";
import { fillTo48, simulateMatch, type MatchResult } from "./tournament";
import { autoLineup, startingPlayers, DEFAULT_FORMATION } from "./squad";

const teams = fillTo48([]);
const byId = new Map(teams.map((t) => [t.id, t]));
const ids48 = teams.map((t) => t.id);

const res = (hg: number, ag: number): MatchResult => ({
  homeGoals: hg,
  awayGoals: ag,
  events: [],
  pens: null,
  winnerId: hg > ag ? "H" : hg < ag ? "A" : "",
});

/** Build a fully-played group from 6 scores in fixture order:
 * [0v1, 2v3, 0v2, 3v1, 0v3, 1v2] (the circle-method schedule). */
function playedGroup(gids: [string, string, string, string], scores: [number, number][]): Group {
  const mds = roundRobin(gids, 0);
  let k = 0;
  const matchdays = mds.map((md) => md.map((m) => ({ ...m, status: "done" as const, result: res(...scores[k++]) }))) as Group["matchdays"];
  return { name: "A", teamIds: gids, matchdays };
}

describe("groups — draw", () => {
  it("draws 12 groups of 4, named A..L in order", () => {
    const stage = drawGroups(ids48, 42);
    expect(stage.groups).toHaveLength(12);
    expect(stage.groups.map((g) => g.name)).toEqual(GROUP_NAMES);
    for (const g of stage.groups) expect(g.teamIds).toHaveLength(4);
  });

  it("partitions the field — every team placed exactly once", () => {
    const stage = drawGroups(ids48, 42);
    const placed = stage.groups.flatMap((g) => g.teamIds);
    expect(placed).toHaveLength(48);
    expect(new Set(placed)).toEqual(new Set(ids48));
  });

  it("is deterministic from the seed", () => {
    expect(drawGroups(ids48, 7)).toEqual(drawGroups(ids48, 7));
    expect(drawGroups(ids48, 7)).not.toEqual(drawGroups(ids48, 8));
  });

  it("rejects a field that isn't exactly 48", () => {
    expect(() => drawGroups(ids48.slice(0, 40), 1)).toThrow();
  });
});

describe("groups — round robin", () => {
  const g: [string, string, string, string] = ["a", "b", "c", "d"];

  it("is 3 matchdays of 2 matches (6 fixtures)", () => {
    const mds = roundRobin(g, 0);
    expect(mds).toHaveLength(3);
    expect(mds.flat()).toHaveLength(6);
  });

  it("gives each team 3 games and every pair exactly once", () => {
    const fixtures = roundRobin(g, 0).flat();
    for (const t of g) expect(fixtures.filter((m) => m.homeId === t || m.awayId === t)).toHaveLength(3);
    const pairs = fixtures.map((m) => [m.homeId, m.awayId].sort().join("-"));
    expect(new Set(pairs).size).toBe(6); // all 6 distinct unordered pairs
  });
});

describe("groups — standings", () => {
  const g: [string, string, string, string] = ["A", "B", "C", "D"];

  it("computes points/played correctly (a team that wins all 3 → 9 pts, W3)", () => {
    // A beats B,C,D 2-0; among the rest B>C>D
    const table = standings(playedGroup(g, [
      [2, 0], // A 0v1 B
      [1, 0], // C 2v3 D
      [2, 0], // A 0v2 C
      [0, 1], // D 3v1 B  → B beats D
      [2, 0], // A 0v3 D
      [1, 0], // B 1v2 C  → B beats C
    ]), 1);
    expect(table).toHaveLength(4);
    for (const r of table) expect(r.P).toBe(3);
    const a = table.find((r) => r.teamId === "A")!;
    expect(a.Pts).toBe(9);
    expect(a.W).toBe(3);
    expect(table[0].teamId).toBe("A"); // top of the group
  });

  it("orders by points, then goal difference, then goals for", () => {
    // B & C both finish W2-L1 (6 pts), but B on +4 GD vs C on -1 → B ranks above.
    const table = standings(playedGroup(g, [
      [0, 3], // A vs B → B beats A 3-0
      [0, 3], // C vs D → D beats C 3-0
      [0, 1], // A vs C → C beats A 1-0
      [0, 2], // D vs B → B beats D 2-0
      [2, 0], // A vs D → A beats D 2-0
      [0, 1], // B vs C → C beats B 1-0
    ]), 1);
    const pos = (id: string) => table.findIndex((r) => r.teamId === id);
    const B = table.find((r) => r.teamId === "B")!;
    const C = table.find((r) => r.teamId === "C")!;
    expect(B.Pts).toBe(6);
    expect(C.Pts).toBe(6);
    expect(B.GD).toBeGreaterThan(C.GD); // +4 vs -1 → B ranks above
    expect(pos("B")).toBeLessThan(pos("C"));
  });

  it("breaks a dead heat by a deterministic seeded lot", () => {
    const allDraw: [number, number][] = [[1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1]];
    const t1 = standings(playedGroup(g, allDraw), 5);
    for (const r of t1) { expect(r.Pts).toBe(3); expect(r.GD).toBe(0); }
    expect(standings(playedGroup(g, allDraw), 5)).toEqual(t1); // stable for a seed
    const t2 = standings(playedGroup(g, allDraw), 999);
    expect(t2.map((r) => r.teamId)).not.toEqual(t1.map((r) => r.teamId)); // a different seed can reorder
  });
});

describe("groups — qualification", () => {
  function playedStage(stageSeed: number) {
    const stage = drawGroups(ids48, stageSeed);
    const sim = (m: GroupMatch): MatchResult => {
      const h = byId.get(m.homeId)!;
      const a = byId.get(m.awayId)!;
      const hxi = startingPlayers(h, autoLineup(h, DEFAULT_FORMATION, {}));
      const axi = startingPlayers(a, autoLineup(a, DEFAULT_FORMATION, {}));
      return simulateMatch(h, a, hxi, axi, groupMatchSeed(stageSeed, m.group, m.matchday, m.slot), { allowDraw: true });
    };
    let s = stage;
    for (let md = 0; md < 3; md++) s = finishMatchday(playMatchday(s, md, sim), md);
    return s;
  }

  it("bestThirds picks exactly the top 8 third-placed teams by pts/GD/GF/seed", () => {
    const s = playedStage(2026);
    const thirds = bestThirds(s);
    expect(thirds).toHaveLength(8);
    // each returned row IS the 3rd place of some group
    const allThirds = s.groups.map((g) => standings(g, s.seed)[2].teamId);
    for (const r of thirds) expect(allThirds).toContain(r.teamId);
    // ranked: no excluded third outranks an included one on pts→GD→GF
    const key = (r: { Pts: number; GD: number; GF: number }) => [r.Pts, r.GD, r.GF];
    const cut = thirds[7];
    const excluded = s.groups.map((g) => standings(g, s.seed)[2]).filter((r) => !thirds.some((t) => t.teamId === r.teamId));
    for (const e of excluded) expect(key(cut) >= key(e) || key(cut).join() === key(e).join()).toBe(true);
  });

  it("qualified32 returns exactly 32 unique ids = 12 firsts + 12 seconds + 8 thirds", () => {
    const s = playedStage(2026);
    const q = qualified32(s);
    expect(q).toHaveLength(32);
    expect(new Set(q).size).toBe(32);
    const firsts = s.groups.map((g) => standings(g, s.seed)[0].teamId);
    const seconds = s.groups.map((g) => standings(g, s.seed)[1].teamId);
    const thirds = bestThirds(s).map((r) => r.teamId);
    expect(q.slice(0, 12)).toEqual(firsts);
    expect(q.slice(12, 24)).toEqual(seconds);
    expect(new Set(q.slice(24))).toEqual(new Set(thirds));
    // every qualifier is a real field team
    for (const id of q) expect(byId.has(id)).toBe(true);
  });

  it("a whole Copa replays identically from one seed", () => {
    expect(qualified32(playedStage(2026))).toEqual(qualified32(playedStage(2026)));
    expect(qualified32(playedStage(2026))).not.toEqual(qualified32(playedStage(2027)));
  });
});

describe("simulateMatch — allowDraw (group mode)", () => {
  const h = teams[0];
  const a = teams[1];
  const hxi = startingPlayers(h, autoLineup(h, DEFAULT_FORMATION, {}));
  const axi = startingPlayers(a, autoLineup(a, DEFAULT_FORMATION, {}));

  it("a level match is a draw (no shootout, no winner) — events unchanged from the knockout call", () => {
    // find a seed that produces a level score under the (default) knockout path
    let tieSeed = -1;
    for (let s = 1; s < 400 && tieSeed < 0; s++) {
      const r = simulateMatch(h, a, hxi, axi, s);
      if (r.homeGoals === r.awayGoals) tieSeed = s;
    }
    expect(tieSeed).toBeGreaterThan(0);
    const draw = simulateMatch(h, a, hxi, axi, tieSeed, { allowDraw: true });
    const knock = simulateMatch(h, a, hxi, axi, tieSeed);
    expect(draw.winnerId).toBe(""); // a draw
    expect(draw.pens).toBeNull();
    expect(knock.pens).not.toBeNull(); // knockout goes to a shootout
    expect(knock.winnerId).not.toBe(""); // and has a winner
    // the ONLY difference is the shootout — goals/scorers/cards are identical
    expect(draw.events).toEqual(knock.events);
    expect(draw.homeGoals).toBe(knock.homeGoals);
    expect(draw.awayGoals).toBe(knock.awayGoals);
  });
});
