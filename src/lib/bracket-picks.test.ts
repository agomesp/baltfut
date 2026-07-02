import { describe, it, expect } from "vitest";
import type { KnockoutColumn, Match } from "@/lib/espn";
import {
  resolveBracketPicks,
  togglePick,
  realWinnersByPos,
  scoreBracketPicks,
  posKey,
  type R32Slot,
} from "@/lib/bracket-picks";

const R32: R32Slot[] = Array.from({ length: 16 }, (_, i) => ({ home: `H${i}`, away: `A${i}` }));

describe("resolveBracketPicks", () => {
  it("advances the picked winners into the next round's slots (real wiring)", () => {
    // R16 tie 0 is fed by R32 ties 1 & 4 (1-based) → R32 index 0 and 3.
    const { rounds } = resolveBracketPicks(R32, { [posKey(0, 0)]: "H0", [posKey(0, 3)]: "A3" });
    expect(rounds[0][0].pickedWinner).toBe("H0");
    expect(rounds[1][0]).toEqual({ home: "H0", away: "A3", pickedWinner: null });
  });

  it("leaves a next-round slot empty until its feeder is picked", () => {
    const { rounds } = resolveBracketPicks(R32, { [posKey(0, 0)]: "H0" });
    expect(rounds[1][0]).toEqual({ home: "H0", away: null, pickedWinner: null });
  });

  it("cascades: changing a feeder pick drops a now-invalid downstream pick", () => {
    // Pick H0 into R16-0 and advance it; then flip R32-0 to A0 → the R16-0 pick H0
    // is no longer one of that tie's teams, so it must be cleared.
    const { rounds, picks } = resolveBracketPicks(R32, {
      [posKey(0, 0)]: "A0",
      [posKey(0, 3)]: "A3",
      [posKey(1, 0)]: "H0",
    });
    expect(rounds[1][0]).toEqual({ home: "A0", away: "A3", pickedWinner: null });
    expect(picks[posKey(1, 0)]).toBeUndefined();
  });

  it("names the champion from the final pick", () => {
    const picks: Record<string, string> = {};
    // Fill one path to the final: winners of R32 → R16 → QF → SF → final.
    // Simplest: set every round-0..3 pick so the final has two teams, then pick one.
    for (let i = 0; i < 16; i++) picks[posKey(0, i)] = `H${i}`;
    const r16 = resolveBracketPicks(R32, picks).rounds[1];
    r16.forEach((t, j) => (picks[posKey(1, j)] = t.home!));
    const qf = resolveBracketPicks(R32, picks).rounds[2];
    qf.forEach((t, j) => (picks[posKey(2, j)] = t.home!));
    const sf = resolveBracketPicks(R32, picks).rounds[3];
    sf.forEach((t, j) => (picks[posKey(3, j)] = t.home!));
    const finalTie = resolveBracketPicks(R32, picks).rounds[4][0];
    picks[posKey(4, 0)] = finalTie.away!;
    expect(resolveBracketPicks(R32, picks).champion).toBe(finalTie.away);
  });
});

describe("togglePick", () => {
  it("selects a team, then deselects it on a second click", () => {
    const a = togglePick({}, 0, 0, "H0");
    expect(a).toEqual({ [posKey(0, 0)]: "H0" });
    expect(togglePick(a, 0, 0, "H0")).toEqual({});
  });

  it("replaces the pick when a different team is clicked", () => {
    expect(togglePick({ [posKey(0, 0)]: "H0" }, 0, 0, "A0")).toEqual({ [posKey(0, 0)]: "A0" });
  });
});

function m(id: string, home: string, away: string, hs: number, as: number, hp?: number, ap?: number): Match {
  return {
    id, league: "fifa.world", stage: "round-of-32", name: "", shortName: "", startsAt: "",
    state: "post", isLive: false, statusDetail: "FT", displayClock: null, venue: null,
    home: { id: home, name: home, abbreviation: home, logo: null },
    away: { id: away, name: away, abbreviation: away, logo: null },
    homeScore: hs, awayScore: as, homeShootout: hp ?? null, awayShootout: ap ?? null, goals: [], cards: [],
  };
}

describe("realWinnersByPos + scoreBracketPicks", () => {
  const columns: KnockoutColumn[] = [
    { slug: "round-of-32", label: "", matches: [m("a", "H0", "A0", 2, 1), m("b", "H1", "A1", 1, 1, 3, 4)] },
    { slug: "final", label: "", matches: [m("f", "H0", "A0", 0, 0, 5, 3)] },
  ];

  it("reads the real advancer (shootout-aware) at each position", () => {
    const real = realWinnersByPos(columns);
    expect(real[posKey(0, 0)]).toBe("H0"); // 2-1
    expect(real[posKey(0, 1)]).toBe("A1"); // 1-1, pens 3-4 → away
    expect(real[posKey(4, 0)]).toBe("H0"); // final pens 5-3 → home
  });

  it("scores 0.2 per correct winner and 1 for a correct champion; pending when undecided", () => {
    const rounds = [
      [
        { home: "H0", away: "A0", pickedWinner: "H0" }, // correct → 0.2
        { home: "H1", away: "A1", pickedWinner: "H1" }, // wrong (real A1)
        { home: "H2", away: "A2", pickedWinner: "H2" }, // pending (no result)
      ],
      [], [], [],
      [{ home: "H0", away: "A0", pickedWinner: "H0" }], // final correct → 1
    ];
    const { total, byPos } = scoreBracketPicks(rounds, realWinnersByPos(columns));
    expect(total).toBeCloseTo(1.2, 5);
    expect(byPos[posKey(0, 0)]).toBe("correct");
    expect(byPos[posKey(0, 1)]).toBe("wrong");
    expect(byPos[posKey(0, 2)]).toBe("pending");
    expect(byPos[posKey(4, 0)]).toBe("correct");
  });
});
