// DEEPER THINKING (TDD) — the pure decision helpers behind the sim's planning layer:
// one-level pass lookahead, the work-it-wide team intention, and the coach brain.
// All pure functions of positions/score state — no RNG, no sim internals — so the
// "thinking" is unit-testable without running matches.
import { describe, it, expect } from "vitest";
import { onwardValue, pickOverloadFlank, coachAdjust, COACH_ZERO, laneClearance } from "./brain";

const G = { x: 50, y: 100 }; // home attacks y=100

describe("laneClearance — the pure lane geometry (moved here from match-sim)", () => {
  it("keeps its contract after the move", () => {
    expect(laneClearance(10, 50, 90, 50, [])).toBe(99);
    expect(laneClearance(10, 50, 90, 50, [{ x: 50, y: 51 }])).toBeLessThan(2);
  });
});

describe("onwardValue — what can the receiver DO next?", () => {
  it("a receiver in a central shooting position beats one parked deep", () => {
    const striker = onwardValue(50, 88, G, [], []);
    const fullback = onwardValue(50, 30, G, [], []);
    expect(striker).toBeGreaterThan(fullback);
  });

  it("a defender camped in the receiver's shot lane suppresses his onward value", () => {
    const clear = onwardValue(50, 80, G, [], []);
    const blocked = onwardValue(50, 80, G, [], [{ x: 50, y: 90 }]);
    expect(blocked).toBeLessThan(clear);
  });

  it("an open teammate further ahead adds onward value for a deep receiver", () => {
    const alone = onwardValue(50, 55, G, [], []);
    const withOutlet = onwardValue(50, 55, G, [{ x: 50, y: 78 }], []);
    expect(withOutlet).toBeGreaterThan(alone);
  });

  it("a marked outlet is worth less than an open one", () => {
    const openOutlet = onwardValue(50, 55, G, [{ x: 44, y: 78 }], []);
    const markedOutlet = onwardValue(50, 55, G, [{ x: 44, y: 78 }], [{ x: 45, y: 79 }]);
    expect(markedOutlet).toBeLessThan(openOutlet);
  });

  it("is bounded to [0, 1] even from absurd positions", () => {
    expect(onwardValue(50, 99, G, [{ x: 50, y: 99 }], [])).toBeLessThanOrEqual(1);
    expect(onwardValue(50, 1, G, [], [{ x: 50, y: 2 }])).toBeGreaterThanOrEqual(0);
  });
});

describe("pickOverloadFlank — attack the emptier side", () => {
  it("picks the flank with fewer defenders", () => {
    // three defenders guard the left channel (x<40), one guards the right
    const defs = [{ x: 20, y: 70 }, { x: 28, y: 75 }, { x: 34, y: 80 }, { x: 74, y: 75 }];
    expect(pickOverloadFlank(defs)).toBe("R");
    const mirrored = defs.map((d) => ({ x: 100 - d.x, y: d.y }));
    expect(pickOverloadFlank(mirrored)).toBe("L");
  });

  it("central defenders count toward neither flank; ties go left (deterministic)", () => {
    expect(pickOverloadFlank([{ x: 50, y: 70 }, { x: 55, y: 80 }])).toBe("L");
    expect(pickOverloadFlank([])).toBe("L");
  });
});

describe("coachAdjust — deterministic tactical shifts from the scoreline", () => {
  it("level early = no adjustment (the game plan holds)", () => {
    expect(coachAdjust(0, 0, 0, 0.3)).toEqual(COACH_ZERO);
  });

  it("losing after halftime pushes: line UP, press tighter, more direct", () => {
    const a = coachAdjust(-1, 4, 8, 0.6);
    expect(a.lineDelta).toBeGreaterThan(0);
    expect(a.pressDelta).toBeGreaterThan(0);
    expect(a.directDelta).toBeGreaterThan(0);
  });

  it("losing by two pushes HARDER than losing by one", () => {
    const one = coachAdjust(-1, 4, 8, 0.7);
    const two = coachAdjust(-2, 4, 8, 0.7);
    expect(two.lineDelta).toBeGreaterThan(one.lineDelta);
    expect(two.directDelta).toBeGreaterThan(one.directDelta);
  });

  it("winning late = the shell: line DOWN, press off, slower tempo", () => {
    const a = coachAdjust(1, 8, 4, 0.8);
    expect(a.lineDelta).toBeLessThan(0);
    expect(a.pressDelta).toBeLessThan(0);
    expect(a.tempoDelta).toBeLessThan(0);
  });

  it("winning EARLY does not shell yet (no bus parked at 30')", () => {
    expect(coachAdjust(1, 6, 4, 0.33)).toEqual(COACH_ZERO);
  });

  it("level late but clearly out-shot = a modest push for the winner", () => {
    const a = coachAdjust(0, 4, 12, 0.8);
    expect(a.lineDelta).toBeGreaterThan(0);
    expect(a.lineDelta).toBeLessThan(coachAdjust(-1, 4, 12, 0.8).lineDelta);
  });

  it("is a pure function: same inputs, same object", () => {
    expect(coachAdjust(-1, 3, 9, 0.61)).toEqual(coachAdjust(-1, 3, 9, 0.61));
  });
});
