import { describe, it, expect } from "vitest";
import type { KnockoutColumn, Match } from "@/lib/espn";
import {
  resolveBracketPicks,
  togglePick,
  realWinnersByPos,
  scoreBracketPicks,
  posKey,
} from "@/lib/bracket-picks";

function mm(home: string, away: string, state: "pre" | "in" | "post", hs?: number, as?: number, hp?: number, ap?: number): Match {
  return {
    id: home + away, league: "fifa.world", stage: "round-of-32", name: "", shortName: "", startsAt: "",
    state, isLive: state === "in", statusDetail: "", displayClock: null, venue: null,
    home: { id: home, name: home, abbreviation: home, logo: null },
    away: { id: away, name: away, abbreviation: away, logo: null },
    homeScore: hs ?? null, awayScore: as ?? null, homeShootout: hp ?? null, awayShootout: ap ?? null, goals: [], cards: [],
  };
}
const r32col = (matches: Match[]): KnockoutColumn => ({ slug: "round-of-32", label: "", matches });
// 16 not-yet-started round-of-32 ties → all pickable.
const R32PRE = r32col(Array.from({ length: 16 }, (_, i) => mm(`H${i}`, `A${i}`, "pre")));

describe("resolveBracketPicks — advancement", () => {
  it("advances the picked winners into the next round's slots (real wiring)", () => {
    // R16 tie 0 is fed by R32 ties 1 & 4 (1-based) → R32 index 0 and 3.
    const { rounds } = resolveBracketPicks([R32PRE], { [posKey(0, 0)]: "H0", [posKey(0, 3)]: "A3" });
    expect(rounds[0][0].pickedWinner).toBe("H0");
    expect(rounds[1][0]).toMatchObject({ home: "H0", away: "A3", pickedWinner: null });
  });

  it("leaves a next-round slot empty until its feeder is picked", () => {
    const { rounds } = resolveBracketPicks([R32PRE], { [posKey(0, 0)]: "H0" });
    expect(rounds[1][0]).toMatchObject({ home: "H0", away: null });
  });

  it("cascades: changing a feeder pick drops a now-invalid downstream pick", () => {
    const { rounds, picks } = resolveBracketPicks([R32PRE], {
      [posKey(0, 0)]: "A0", [posKey(0, 3)]: "A3", [posKey(1, 0)]: "H0",
    });
    expect(rounds[1][0]).toMatchObject({ home: "A0", away: "A3", pickedWinner: null });
    expect(picks[posKey(1, 0)]).toBeUndefined();
  });

  it("names the champion from the final pick", () => {
    const picks: Record<string, string> = {};
    for (let i = 0; i < 16; i++) picks[posKey(0, i)] = `H${i}`;
    for (let r = 1; r <= 3; r++) resolveBracketPicks([R32PRE], picks).rounds[r].forEach((t, j) => (picks[posKey(r, j)] = t.home!));
    const finalTie = resolveBracketPicks([R32PRE], picks).rounds[4][0];
    picks[posKey(4, 0)] = finalTie.away!;
    expect(resolveBracketPicks([R32PRE], picks).champion).toBe(finalTie.away);
  });
});

describe("resolveBracketPicks — lock on match start", () => {
  it("locks a started (finished) tie to reality and drops any pick on it", () => {
    const cols = [r32col([mm("H0", "A0", "post", 2, 1), ...Array.from({ length: 15 }, (_, i) => mm(`H${i + 1}`, `A${i + 1}`, "pre"))])];
    const { rounds, picks } = resolveBracketPicks(cols, { [posKey(0, 0)]: "A0" }); // tried to pick the loser
    expect(rounds[0][0]).toMatchObject({ locked: true, advancer: "H0", realWinner: "H0", pickedWinner: null, live: false });
    expect(picks[posKey(0, 0)]).toBeUndefined();
    // The real winner still advances into the next round's slot.
    expect(rounds[1][0].home).toBe("H0");
  });

  it("locks a live tie with no advancer yet", () => {
    const cols = [r32col([mm("H0", "A0", "in"), ...Array.from({ length: 15 }, (_, i) => mm(`H${i + 1}`, `A${i + 1}`, "pre"))])];
    const { rounds } = resolveBracketPicks(cols, {});
    expect(rounds[0][0]).toMatchObject({ locked: true, live: true, advancer: null });
  });

  it("leaves a not-yet-started tie open to pick", () => {
    const { rounds } = resolveBracketPicks([R32PRE], {});
    expect(rounds[0][0]).toMatchObject({ locked: false, live: false });
  });

  it("frozen (saved): keeps the user's own pick on a since-started tie, but fills unpicked started ties from reality", () => {
    const cols = [r32col([mm("H0", "A0", "post", 2, 1), mm("H1", "A1", "post", 0, 1), ...Array.from({ length: 14 }, (_, i) => mm(`H${i + 2}`, `A${i + 2}`, "pre"))])];
    // The user picked tie 0 (wrongly, A0) before it started; never picked tie 1.
    const { rounds } = resolveBracketPicks(cols, { [posKey(0, 0)]: "A0" }, true);
    expect(rounds[0][0]).toMatchObject({ locked: false, pickedWinner: "A0" }); // their pick stays → scored
    expect(rounds[0][1]).toMatchObject({ locked: true, advancer: "A1" }); // unpicked → reality
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

describe("realWinnersByPos + scoreBracketPicks", () => {
  const columns: KnockoutColumn[] = [
    r32col([mm("H0", "A0", "post", 2, 1), mm("H1", "A1", "post", 1, 1, 3, 4)]),
    { slug: "final", label: "", matches: [mm("H0", "A0", "post", 0, 0, 5, 3)] },
  ];

  it("reads the real advancer (shootout-aware) at each position", () => {
    const real = realWinnersByPos(columns);
    expect(real[posKey(0, 0)]).toBe("H0"); // 2-1
    expect(real[posKey(0, 1)]).toBe("A1"); // 1-1, pens 3-4 → away
    expect(real[posKey(4, 0)]).toBe("H0"); // final pens 5-3 → home
  });

  it("scores a flat 0.2 per correct winner (champion included); pending when undecided", () => {
    const rounds = [
      [
        { home: "H0", away: "A0", pickedWinner: "H0" }, // correct → 0.2
        { home: "H1", away: "A1", pickedWinner: "H1" }, // wrong (real A1)
        { home: "H2", away: "A2", pickedWinner: "H2" }, // pending (no result)
      ],
      [], [], [],
      [{ home: "H0", away: "A0", pickedWinner: "H0" }], // final correct → 0.2
    ] as never;
    const { total, byPos } = scoreBracketPicks(rounds, realWinnersByPos(columns));
    expect(total).toBeCloseTo(0.4, 5);
    expect(byPos[posKey(0, 0)]).toBe("correct");
    expect(byPos[posKey(0, 1)]).toBe("wrong");
    expect(byPos[posKey(0, 2)]).toBe("pending");
    expect(byPos[posKey(4, 0)]).toBe("correct");
  });
});
