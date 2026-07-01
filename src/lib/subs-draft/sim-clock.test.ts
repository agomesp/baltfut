// A0.2 — the fixed-timestep accumulator + render interpolation.
//
// The seeded sim (A0.1) only replays identically if it's STEPPED identically —
// a variable per-frame dt makes two viewers at different frame rates diverge.
// createSimClock decouples the sim tick (fixed FIXED_DT) from the render/pump
// rate: `advance(nowMs)` reads the wall clock ONLY to choose how many fixed
// steps to run — wall time never enters the sim's maths. Interpolation between
// the two most recent authoritative snapshots is strictly cosmetic (read-only).
import { describe, it, expect, vi } from "vitest";
import { createSimClock, lerpSnapshot, reconcileEvents, FIXED_DT, MAX_STEPS } from "./sim-clock";
import { createMatchSim, type Snapshot } from "./match-sim";
import { autoLineup, fieldLayout } from "./squad";
import { mockField } from "./tournament";

const field = mockField();
const homeSlots = fieldLayout(field[0], autoLineup(field[0], "4-4-2", {}), "home");
const awaySlots = fieldLayout(field[1], autoLineup(field[1], "4-3-3", {}), "away");

describe("A0.2 — createSimClock accumulator", () => {
  it("first advance only establishes the timebase (0 steps), then steps at FIXED_DT", () => {
    // Base at 0: `bigMs + 1000/60 - bigMs` loses a ULP to float cancellation and
    // can land a hair below FIXED_DT (the accumulator self-corrects next frame, so
    // it's harmless live) — basing at 0 keeps the boundary assertions exact.
    const step = vi.fn();
    const clock = createSimClock(step);
    expect(clock.advance(0)).toBe(0); // timebase
    expect(step).not.toHaveBeenCalled();
    // exactly one fixed step's worth of wall time → exactly one step of FIXED_DT
    expect(clock.advance(1000 / 60)).toBe(1);
    expect(step).toHaveBeenCalledTimes(1);
    expect(step).toHaveBeenLastCalledWith(FIXED_DT);
    // +100ms → floor(0.1 / (1/60)) = 6 steps, each exactly FIXED_DT
    expect(clock.advance(1000 / 60 + 100)).toBe(6);
    expect(step).toHaveBeenCalledTimes(7);
    for (const call of step.mock.calls) expect(call[0]).toBe(FIXED_DT);
  });

  it("alpha() reports the leftover accumulator as a 0..1 fraction of a step", () => {
    const clock = createSimClock(() => {});
    clock.advance(0);
    clock.advance(25); // 25ms → 1 step (16.67ms), ~8.3ms left → alpha ~0.5
    expect(clock.alpha()).toBeGreaterThanOrEqual(0);
    expect(clock.alpha()).toBeLessThan(1);
    expect(clock.alpha()).toBeCloseTo(0.5, 1);
  });

  it("caps a long freeze at MAX_STEPS (spiral-of-death guard) and flags wasCapped", () => {
    const step = vi.fn();
    const clock = createSimClock(step);
    clock.advance(0);
    expect(clock.advance(10_000)).toBe(MAX_STEPS); // 10s would be ~600 steps; clamped to 15
    expect(step).toHaveBeenCalledTimes(MAX_STEPS);
    expect(clock.wasCapped()).toBe(true);
  });

  it("dual-pump idempotency: a second advance at the same instant runs 0 steps", () => {
    const clock = createSimClock(() => {});
    clock.advance(0);
    const t = FIXED_DT * 1000;
    expect(clock.advance(t)).toBe(1);
    expect(clock.advance(t)).toBe(0); // rAF + worker at the same now → no double-step
  });

  it("guards non-monotonic time (clock skew) — never steps backward", () => {
    const step = vi.fn();
    const clock = createSimClock(step);
    clock.advance(1000);
    clock.advance(1100);
    step.mockClear();
    expect(clock.advance(1050)).toBe(0); // time went backward
    expect(step).not.toHaveBeenCalled();
  });

  it("reset() re-bases the timebase and clears the accumulator", () => {
    const clock = createSimClock(() => {});
    clock.advance(0);
    clock.advance(40); // partial + leftover
    clock.reset(1000);
    expect(clock.advance(1000)).toBe(0);
    expect(clock.alpha()).toBe(0);
  });

  it("is frame-rate independent: 60×16.67ms == 15×66.67ms for the same seed", () => {
    const drive = (deltas: number[]): Snapshot => {
      const sim = createMatchSim(homeSlots, awaySlots, 4242);
      const clock = createSimClock((dt) => sim.step(dt, 0.5));
      let now = 0;
      clock.advance(now);
      for (const d of deltas) {
        now += d;
        clock.advance(now);
      }
      return sim.snapshot();
    };
    const fast = drive(Array.from({ length: 60 }, () => 1000 / 60)); // 60fps for 1s
    const slow = drive(Array.from({ length: 15 }, () => 1000 / 15)); // 15fps for 1s
    expect(slow).toEqual(fast); // same total elapsed → same fixed step count → identical
  });
});

describe("A0.2 — cosmetic interpolation is read-only", () => {
  it("lerpSnapshot blends positions without touching the sim, into a fresh object", () => {
    const sim = createMatchSim(homeSlots, awaySlots, 7);
    for (let i = 0; i < 30; i++) sim.step(FIXED_DT, 0.2);
    const a = sim.snapshot();
    const b = sim.snapshot();
    const interp = lerpSnapshot(a, b, 0.5);
    // interpolating must not have mutated the sim
    expect(sim.snapshot()).toEqual(a);
    // and it must return distinct arrays, not alias the sim's snapshot output
    expect(interp.home).not.toBe(a.home);
    expect(interp.ball).not.toBe(a.ball);
    // midpoint of two identical snapshots is that same point
    expect(interp.home[0].x).toBeCloseTo(a.home[0].x, 6);
  });

  it("lerpSnapshot at alpha 0 and 1 returns prev and curr respectively", () => {
    const prev = { home: [{ x: 0, y: 0 }], away: [{ x: 0, y: 0 }], ball: { x: 0, y: 0, z: 0 } } as unknown as Snapshot;
    const curr = { home: [{ x: 10, y: 20 }], away: [{ x: 0, y: 0 }], ball: { x: 4, y: 8, z: 10 } } as unknown as Snapshot;
    expect(lerpSnapshot(prev, curr, 0).home[0]).toEqual({ x: 0, y: 0 });
    expect(lerpSnapshot(prev, curr, 1).home[0]).toEqual({ x: 10, y: 20 });
    expect(lerpSnapshot(prev, curr, 0.5).ball).toEqual({ x: 2, y: 4, z: 5 }); // ball height interpolates too
  });
});

describe("A0.2 — reconcileEvents (catch-up caption reconciliation)", () => {
  const snap = (eventSeq: number, eventText: string) => ({ eventSeq, eventText }) as Snapshot;

  it("no new event → nothing to show", () => {
    expect(reconcileEvents(3, snap(3, "x"), false)).toEqual({ ticker: [], resync: false, nextSeq: 3 });
  });

  it("a single new event animates normally (one line, no resync)", () => {
    expect(reconcileEvents(3, snap(4, "Gol"), false)).toEqual({ ticker: ["Gol"], resync: false, nextSeq: 4 });
  });

  it("a batch jump (catch-up) shows ONE line and flags resync — never replays N captions", () => {
    expect(reconcileEvents(3, snap(9, "Cartão"), false)).toEqual({ ticker: ["Cartão"], resync: true, nextSeq: 9 });
  });

  it("wasCapped forces resync even for a single-step jump", () => {
    expect(reconcileEvents(3, snap(4, "Gol"), true)).toEqual({ ticker: ["Gol"], resync: true, nextSeq: 4 });
  });
});
