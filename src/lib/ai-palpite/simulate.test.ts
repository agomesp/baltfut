import { describe, expect, it } from "vitest";
import { simulateBracket } from "@/lib/ai-palpite/simulate";
import type { Group, Match, MatchState, StandingRow } from "@/lib/espn";

function team(code: string, name = code) {
  return { id: code, name, abbreviation: code, logo: null };
}

function m(
  id: string,
  homeCode: string,
  awayCode: string,
  stage: string,
  startsAt: string,
  state: MatchState = "pre",
): Match {
  return {
    id,
    league: "fifa.world",
    stage,
    name: `${homeCode} v ${awayCode}`,
    shortName: `${homeCode} v ${awayCode}`,
    startsAt,
    state,
    isLive: false,
    statusDetail: "",
    displayClock: null,
    venue: null,
    home: team(homeCode),
    away: team(awayCode, awayCode),
    homeScore: null,
    awayScore: null,
    goals: [],
    cards: [],
  };
}

function row(rank: number, code: string, points: number, gd: string): StandingRow {
  return { rank, code, name: code, played: 3, gd, points, advanced: rank <= 2 };
}

/** Twelve groups A–L, four teams each; only the codes/strengths matter here. */
function makeGroups(): Group[] {
  const seed: Record<string, string[]> = {
    A: ["MEX", "RSA", "KOR", "CZE"],
    B: ["SUI", "CAN", "BIH", "QAT"],
    C: ["BRA", "MAR", "SCO", "HAI"],
    D: ["USA", "AUS", "PAR", "TUR"],
    E: ["GER", "CIV", "ECU", "CUW"],
    F: ["NED", "JPN", "SWE", "TUN"],
    G: ["EGY", "BEL", "IRN", "NZL"],
    H: ["ESP", "CPV", "URU", "KSA"],
    I: ["FRA", "NOR", "SEN", "IRQ"],
    J: ["ARG", "AUT", "ALG", "JOR"],
    K: ["COL", "POR", "COD", "UZB"],
    L: ["ENG", "GHA", "CRO", "PAN"],
  };
  return Object.entries(seed).map(([letter, codes]) => ({
    letter,
    name: `Group ${letter}`,
    rows: codes.map((c, i) => row(i + 1, c, 9 - i * 3, i === 0 ? "+5" : "0")),
  }));
}

/** Sixteen round-of-32 fixtures mirroring the real 2026 slot layout, in kickoff
 *  order (slot numbers 1–16). Decided teams use codes; the rest are seeds. */
function makeR32(): Match[] {
  const t = (n: number) => `2026-07-0${Math.min(9, 1 + Math.floor(n / 3))}T${10 + (n % 12)}:00Z`;
  const defs: [string, string][] = [
    ["RSA", "CAN"], // 1
    ["BRA", "JPN"], // 2
    ["GER", "Third Place Group A/B/C/D/F"], // 3
    ["NED", "MAR"], // 4
    ["CIV", "Group I 2nd Place"], // 5
    ["Group I Winner", "Third Place Group C/D/F/G/H"], // 6
    ["MEX", "Third Place Group C/E/F/H/I"], // 7
    ["Group L Winner", "Third Place Group E/H/I/J/K"], // 8
    ["Group G Winner", "Third Place Group A/E/H/I/J"], // 9
    ["USA", "BIH"], // 10
    ["Group H Winner", "Group J 2nd Place"], // 11
    ["Group K 2nd Place", "Group L 2nd Place"], // 12
    ["SUI", "Third Place Group E/F/G/I/J"], // 13
    ["AUS", "Group G 2nd Place"], // 14
    ["ARG", "Group H 2nd Place"], // 15
    ["Group K Winner", "Third Place Group D/E/I/J/L"], // 16
  ];
  return defs.map(([h, a], i) => m(`ko${i + 1}`, h, a, "round-of-32", t(i)));
}

describe("simulateBracket", () => {
  const groups = makeGroups();
  const r32 = makeR32();

  it("returns an empty bracket when the round of 32 isn't fully drawn", () => {
    const sim = simulateBracket(r32.slice(0, 10), groups);
    expect(sim.columns).toEqual([]);
    expect(sim.champion).toBeNull();
  });

  it("produces every knockout column down to a single final", () => {
    const sim = simulateBracket(r32, groups);
    expect(sim.columns.map((c) => c.slug)).toEqual([
      "round-of-32",
      "round-of-16",
      "quarterfinals",
      "semifinals",
      "final",
    ]);
    expect(sim.columns.map((c) => c.ties.length)).toEqual([16, 8, 4, 2, 1]);
  });

  it("resolves every slot to a concrete team (no leftover seed labels)", () => {
    const sim = simulateBracket(r32, groups);
    for (const col of sim.columns) {
      for (const tie of col.ties) {
        expect(tie.home.code).not.toMatch(/Group|Place|Winner|Third/);
        expect(tie.away.code).not.toMatch(/Group|Place|Winner|Third/);
      }
    }
  });

  it("never double-books a team in the round of 32", () => {
    // BIH is both a decided R32 side (USA–BIH) and group B's third place; the
    // allocator must not also drop it into an open 'Third Place Group' seed.
    const sim = simulateBracket(r32, groups);
    const codes = sim.columns[0].ties.flatMap((t) => [t.home.code, t.away.code]);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.filter((c) => c === "BIH")).toHaveLength(1);
  });

  it("names a champion, runner-up and third place", () => {
    const sim = simulateBracket(r32, groups);
    expect(sim.champion).not.toBeNull();
    expect(sim.runnerUp).not.toBeNull();
    expect(sim.third).not.toBeNull();
    expect(sim.thirdPlace).not.toBeNull();
    // Champion is the final's winner.
    const final = sim.columns.at(-1)!.ties[0];
    const champ = final.winner === "home" ? final.home : final.away;
    expect(sim.champion!.code).toBe(champ.code);
  });

  it("marks decided teams real and projected seeds as projected", () => {
    const sim = simulateBracket(r32, groups);
    const r32col = sim.columns[0];
    const rsaCan = r32col.ties[0];
    expect(rsaCan.home.projected).toBe(false); // RSA decided
    expect(rsaCan.away.projected).toBe(false); // CAN decided
    const gerThird = r32col.ties[2];
    expect(gerThird.home.projected).toBe(false); // GER decided
    expect(gerThird.away.projected).toBe(true); // resolved third place
  });

  it("assigns each third place to a slot whose group set allows it", () => {
    const sim = simulateBracket(r32, groups);
    // Slot 3's away allows groups A/B/C/D/F; the assigned third must be from one.
    const thirdSeedGroups = new Set(["A", "B", "C", "D", "F"]);
    const third3 = sim.columns[0].ties[2].away;
    const fromGroup = groups.find((g) => g.rows[2].code === third3.code)?.letter;
    expect(thirdSeedGroups.has(fromGroup ?? "")).toBe(true);
  });
});

/** A finished/pending round-of-32 fixture with a real scoreline and optional
 *  shootout — mirrors the live 2026 bracket to test the reality overlay. */
function realMatch(
  id: string,
  homeCode: string,
  awayCode: string,
  startsAt: string,
  opts: {
    state?: MatchState;
    hs?: number | null;
    as?: number | null;
    hp?: number | null;
    ap?: number | null;
  } = {},
): Match {
  const base = m(id, homeCode, awayCode, "round-of-32", startsAt, opts.state ?? "post");
  return {
    ...base,
    homeScore: opts.hs ?? null,
    awayScore: opts.as ?? null,
    homeShootout: opts.hp ?? null,
    awayShootout: opts.ap ?? null,
  };
}

/** The live round of 32 (kickoff order 1–16): ties 1–7 finished, 8–16 pending.
 *  Ties 3 (GER→PAR) and 4 (NED→MAR) were upsets the strength model got wrong. */
function liveR32(): Match[] {
  const t = (n: number) => `2026-07-0${Math.min(9, 1 + Math.floor(n / 4))}T0${n % 8}:00Z`;
  const defs: [string, string, Parameters<typeof realMatch>[4]][] = [
    ["RSA", "CAN", { hs: 0, as: 1 }],
    ["BRA", "JPN", { hs: 2, as: 1 }],
    ["GER", "PAR", { hs: 1, as: 1, hp: 3, ap: 4 }],
    ["NED", "MAR", { hs: 1, as: 1, hp: 2, ap: 3 }],
    ["CIV", "NOR", { hs: 1, as: 2 }],
    ["FRA", "SWE", { hs: 3, as: 0 }],
    ["MEX", "ECU", { hs: 2, as: 0 }],
    ["ENG", "COD", { state: "pre" }],
    ["BEL", "SEN", { state: "pre" }],
    ["USA", "BIH", { state: "pre" }],
    ["ESP", "AUT", { state: "pre" }],
    ["POR", "CRO", { state: "pre" }],
    ["SUI", "ALG", { state: "pre" }],
    ["AUS", "EGY", { state: "pre" }],
    ["ARG", "CPV", { state: "pre" }],
    ["COL", "GHA", { state: "pre" }],
  ];
  return defs.map(([h, a, o], i) => realMatch(`r${i + 1}`, h, a, t(i), o));
}

describe("simulateBracket — reality overlay", () => {
  const groups = makeGroups();
  const r32 = liveR32();

  it("keeps the real scoreline and advancer for a finished tie the model called right", () => {
    const tie = simulateBracket(r32, groups).columns[0].ties[1]; // BRA 2–1 JPN
    expect(tie.decided).toBe(true);
    expect([tie.homeGoals, tie.awayGoals]).toEqual([2, 1]);
    expect(tie.winner).toBe("home");
    expect(tie.miss).toBe(false);
  });

  it("flags an upset as a miss, keeping the real result and pen tally", () => {
    const [, , ger, ned] = simulateBracket(r32, groups).columns[0].ties;
    // Tie 3: GER 1–1 PAR (pens 3–4) — model backed GER, Paraguay went through.
    expect(ger.decided).toBe(true);
    expect(ger.miss).toBe(true);
    expect(ger.winner).toBe("away"); // PAR
    expect(ger.predictedWinner).toBe("home"); // GER
    expect(ger.penalties).toBe(true);
    expect([ger.homePens, ger.awayPens]).toEqual([3, 4]);
    // Tie 4: NED 1–1 MAR (pens 2–3) — model backed NED, Morocco went through.
    expect(ned.miss).toBe(true);
    expect(ned.winner).toBe("away"); // MAR
    expect([ned.homePens, ned.awayPens]).toEqual([2, 3]);
  });

  it("leaves a pending tie as a projection", () => {
    const eng = simulateBracket(r32, groups).columns[0].ties[7]; // ENG vs COD
    expect(eng.decided).toBe(false);
    expect(eng.miss).toBe(false);
  });

  it("advances the real winners into the true round-of-16 pairings", () => {
    const r16 = simulateBracket(r32, groups).columns[1].ties;
    const pair = (t: (typeof r16)[number]) => [t.home.code, t.away.code].sort();
    // Real wiring: [1,4] CAN–MAR, [3,6] PAR–FRA, [2,5] BRA–NOR, [7,8] MEX–winner8.
    expect(pair(r16[0])).toEqual(["CAN", "MAR"]);
    expect(pair(r16[1])).toEqual(["FRA", "PAR"]);
    expect(pair(r16[2])).toEqual(["BRA", "NOR"]);
    expect(pair(r16[3])).toEqual(["ENG", "MEX"]); // MEX real, ENG projected past COD
  });
});
