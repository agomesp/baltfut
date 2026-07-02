// PLAYER KINEMATICS (TDD) — the pure movement-physics helpers: the id-hash
// attribute split {topSpeed, accel, agility, reaction, strength}, the speed-scaled
// turn-rate clamp with plant-and-cut braking, and the 8-way facing quantizer.
import { describe, it, expect } from "vitest";
import { deriveAttrs, applyTurn, sector8, hash01 } from "./kinematics";

describe("hash01", () => {
  it("is deterministic and spread over [0,1)", () => {
    expect(hash01("abc")).toBe(hash01("abc"));
    expect(hash01("abc")).not.toBe(hash01("abd"));
    expect(hash01("x")).toBeGreaterThanOrEqual(0);
    expect(hash01("x")).toBeLessThanOrEqual(1);
  });
});

describe("deriveAttrs — one rating splits into a kinematic profile", () => {
  it("is a pure function of (id, rating): same inputs, same profile", () => {
    expect(deriveAttrs("p1", 80)).toEqual(deriveAttrs("p1", 80));
  });

  it("different ids at the same rating get DIFFERENT profiles (the split)", () => {
    const a = deriveAttrs("striker-1", 80);
    const b = deriveAttrs("winger-2", 80);
    expect(a.agility !== b.agility || a.accelF !== b.accelF || a.topSpeedF !== b.topSpeedF).toBe(true);
  });

  it("higher rating reacts faster and turns no worse (same id)", () => {
    const low = deriveAttrs("p9", 62);
    const high = deriveAttrs("p9", 90);
    expect(high.reaction).toBeLessThan(low.reaction);
    expect(high.agility).toBeGreaterThanOrEqual(low.agility);
  });

  it("stays in sane bands across many ids", () => {
    for (let i = 0; i < 50; i++) {
      const k = deriveAttrs(`id-${i}`, 60 + (i % 30));
      expect(k.topSpeedF).toBeGreaterThan(0.9);
      expect(k.topSpeedF).toBeLessThan(1.1);
      expect(k.accelF).toBeGreaterThan(0.8);
      expect(k.accelF).toBeLessThan(1.2);
      expect(k.agility).toBeGreaterThan(4);
      expect(k.agility).toBeLessThan(12);
      expect(k.reaction).toBeGreaterThanOrEqual(0.12);
      expect(k.reaction).toBeLessThanOrEqual(0.42);
      expect(k.strength).toBeGreaterThan(0.7);
      expect(k.strength).toBeLessThan(1.3);
    }
  });
});

describe("applyTurn — momentum makes direction a COST", () => {
  it("a slow player turns freely (turning in place is easy)", () => {
    const t = applyTurn(1, 0, 0, 12, 8, 1 / 60);
    expect(t.vx).toBe(0);
    expect(t.vy).toBe(12);
  });

  it("a sprinting player CANNOT snap 90° in one tick — he arcs", () => {
    const t = applyTurn(18, 0, 0, 18, 8, 1 / 60);
    const angle = Math.atan2(t.vy, t.vx);
    expect(angle).toBeGreaterThan(0); // began turning
    expect(angle).toBeLessThan(Math.PI / 6); // nowhere near the demanded 90° yet
  });

  it("higher agility closes the same turn faster", () => {
    const slow = applyTurn(18, 0, 0, 18, 5, 1 / 60);
    const agile = applyTurn(18, 0, 0, 18, 11, 1 / 60);
    expect(Math.atan2(agile.vy, agile.vx)).toBeGreaterThan(Math.atan2(slow.vy, slow.vx));
  });

  it("a REVERSAL at speed brakes first (plant-and-cut), not a pirouette", () => {
    const t = applyTurn(18, 0, -18, 0, 8, 1 / 60);
    const sp = Math.hypot(t.vx, t.vy);
    expect(sp).toBeLessThan(18); // decelerating
    expect(t.vx).toBeGreaterThan(0); // still travelling the old way — hasn't flipped in one tick
  });

  it("many ticks eventually complete the turn (the clamp delays, never blocks)", () => {
    let v = { vx: 18, vy: 0 };
    for (let i = 0; i < 90; i++) v = applyTurn(v.vx, v.vy, 0, 18, 8, 1 / 60);
    const angle = Math.atan2(v.vy, v.vx);
    expect(angle).toBeGreaterThan(Math.PI / 2 - 0.15); // ~fully around inside 1.5s
  });
});

describe("sector8 — quantized facing for the renderer", () => {
  it("maps the cardinal + diagonal headings to the 8 sectors", () => {
    expect(sector8(0)).toBe(0); // +x (east/right)
    expect(sector8(Math.PI / 4)).toBe(1); // NE
    expect(sector8(Math.PI / 2)).toBe(2); // +y (north/away)
    expect(sector8(Math.PI)).toBe(4); // -x (west/left)
    expect(sector8(-Math.PI / 2)).toBe(6); // -y (south/near)
    expect(sector8(-Math.PI / 4)).toBe(7); // SE
  });

  it("wraps and rounds to the nearest sector", () => {
    expect(sector8(Math.PI / 8 - 0.01)).toBe(0);
    expect(sector8(Math.PI / 8 + 0.01)).toBe(1);
    expect(sector8(2 * Math.PI)).toBe(0);
  });
});
