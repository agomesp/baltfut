// MAGNUS (TDD) — pure spin aerodynamics for the ball. Positive spin curls the
// ball LEFT of its velocity (90° CCW); magnitude scales with spin × speed. The
// sim integrates this per step and decays spin in flight.
import { describe, it, expect } from "vitest";
import { magnusAccel, spinDecay, curlSign, K_MAGNUS } from "./ball-physics";

describe("magnusAccel", () => {
  it("is perpendicular to the velocity (never speeds the ball up or slows it)", () => {
    const { ax, ay } = magnusAccel(30, 40, 0.7);
    expect(ax * 30 + ay * 40).toBeCloseTo(0, 10);
  });

  it("positive spin curls LEFT of the velocity (90° CCW)", () => {
    // moving +y (up the pitch): left is -x
    const up = magnusAccel(0, 50, 0.8);
    expect(up.ax).toBeLessThan(0);
    expect(up.ay).toBeCloseTo(0, 10);
    // moving +x: left is +y
    const right = magnusAccel(50, 0, 0.8);
    expect(right.ay).toBeGreaterThan(0);
  });

  it("negative spin curls the other way", () => {
    const { ax } = magnusAccel(0, 50, -0.8);
    expect(ax).toBeGreaterThan(0);
  });

  it("scales with speed and spin; zero at rest or spinless", () => {
    const slow = magnusAccel(0, 20, 0.5);
    const fast = magnusAccel(0, 40, 0.5);
    expect(Math.abs(fast.ax)).toBeCloseTo(Math.abs(slow.ax) * 2, 6);
    expect(magnusAccel(0, 0, 0.9)).toEqual({ ax: 0, ay: 0 });
    expect(magnusAccel(30, 10, 0)).toEqual({ ax: 0, ay: 0 });
  });

  it("produces a visible but sane curl over a corner-length flight", () => {
    // integrate a corner-ish delivery: |v|≈70, s=0.7, ~0.8s of flight
    let y = 0, vx = 70, vy = 0;
    const s = 0.7, dt = 1 / 60;
    for (let i = 0; i < 48; i++) {
      const a = magnusAccel(vx, vy, s);
      vx += a.ax * dt; vy += a.ay * dt;
      y += vy * dt;
    }
    expect(Math.abs(y)).toBeGreaterThan(3); // the curl is VISIBLE
    expect(Math.abs(y)).toBeLessThan(14); // but it's football, not a boomerang
  });
});

describe("spinDecay", () => {
  it("decays exponentially and outlasts a typical flight", () => {
    let s = 1;
    for (let i = 0; i < 60; i++) s = spinDecay(s, 1 / 60); // one second
    expect(s).toBeGreaterThan(0.45); // still curling at the far post
    expect(s).toBeLessThan(0.75);
  });
});

describe("curlSign — which way does an inswinger curl?", () => {
  it("points the curl toward the target (goalmouth) from either corner", () => {
    // left corner (x=2, y=98), delivering toward the goalmouth (50, 91), goal at (50, 100):
    // the goal is LEFT of the velocity → positive spin curls in
    expect(curlSign(48, -7, 48, 2)).toBe(1);
    // right corner (x=98): mirrored → negative
    expect(curlSign(-48, -7, -48, 2)).toBe(-1);
  });
});

describe("K_MAGNUS", () => {
  it("is exported for the sim's analytic deflection estimates", () => {
    expect(K_MAGNUS).toBeGreaterThan(0);
  });
});
