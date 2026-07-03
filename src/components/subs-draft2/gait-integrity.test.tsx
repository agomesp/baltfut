// GAIT INTEGRITY — headless reproduction of the render pipeline: run the REAL sim,
// derive per-frame velocities with the pump's OWN updateSkelVel (shared export, not
// a hand copy), drive stepGait, and assert feet never stream away from bodies (the
// "shin streak" artifact). Hardened by the closeout review: the bound sits BELOW
// the 6-unit hard-snap threshold (so disabling either the radial stepping or the
// snap fails the test), and the kick / idle / catch-up-burst states — which the
// original harness never entered — get direct coverage.
import { describe, it, expect } from "vitest";
import { stepGait, updateSkelVel, capFootReach, type Skel } from "./pitch-view";
import { createMatchSim } from "@/lib/subs-draft/match-sim";
import { autoLineup, fieldLayout, type FieldSlot } from "@/lib/subs-draft/squad";
import { mockField } from "@/lib/subs-draft/tournament";
import { FIXED_DT } from "@/lib/subs-draft/sim-timing";

function mkSkels(xi: FieldSlot[]): Skel[] {
  return xi.map((a) => ({
    feet: [{ x: a.x - 1.1, y: a.y }, { x: a.x + 1.1, y: a.y }] as [{ x: number; y: number }, { x: number; y: number }],
    swing: -1, swingT: 0, target: { x: a.x, y: a.y },
    vx: 0, vy: 0, ax: 0, ay: 0, gait: 0, lean: 0, kickT: 0, kx: 0, ky: 1, fall: 0,
  }));
}

const mkOne = (): Skel => mkSkels([{ id: "t", name: "T", role: "Meio-campo", rating: 78, x: 50, y: 50 } as FieldSlot])[0];

describe("gait integrity — feet stay under bodies through kinematic movement", () => {
  it("max foot-body distance stays under the hard-snap threshold over 3600 frames", () => {
    const field = mockField();
    const homeXI = fieldLayout(field[0], autoLineup(field[0], "4-4-2", {}), "home");
    const awayXI = fieldLayout(field[1], autoLineup(field[1], "4-3-3", {}), "away");
    const sim = createMatchSim(homeXI, awayXI, 1000, { scoring: true });
    const skels = { home: mkSkels(homeXI), away: mkSkels(awayXI) };
    let prev = sim.snapshot();
    let maxDist = 0;
    let maxAt = "";
    for (let i = 0; i < 3600; i++) {
      sim.step(FIXED_DT);
      const snap = sim.snapshot();
      const upd = (cur: { x: number; y: number }[], pv: { x: number; y: number }[], sk: Skel[], label: string) => {
        cur.forEach((p, k) => {
          const s = sk[k];
          updateSkelVel(s, p, pv[k], 1 / FIXED_DT); // the pump's own math — shared export
          stepGait(s, p, FIXED_DT);
          for (const f of s.feet) {
            const d = Math.hypot(f.x - p.x, f.y - p.y);
            if (d > maxDist) { maxDist = d; maxAt = `${label}[${k}] frame ${i} fall=${s.fall.toFixed(2)} kickT=${s.kickT.toFixed(2)} swing=${s.swing} speed=${Math.hypot(s.vx, s.vy).toFixed(1)}`; }
          }
        });
      };
      upd(snap.home, prev.home, skels.home, "home");
      upd(snap.away, prev.away, skels.away, "away");
      prev = snap;
    }
    process.stdout.write(`max foot-body dist: ${maxDist.toFixed(1)} at ${maxAt}\n`);
    // BELOW the 6-unit snap: if radial stepping regresses, drift reaches 6 and fails
    // here before the snap can hide it (measured healthy max ≈ 4.6).
    expect(maxDist).toBeLessThan(6);
  }, 120_000);

  it("the hard snap rescues a stranded foot in EVERY state (idle, moving, kick)", () => {
    for (const state of ["idle", "moving", "kick"] as const) {
      const s = mkOne();
      const p = { x: 50, y: 50 };
      s.feet[0] = { x: 30, y: 50 }; // 20 units away — far past any legitimate stride
      s.swing = 0;
      if (state === "moving") { s.vx = 0; s.vy = 8; }
      if (state === "kick") { s.kickT = 0.3; s.kx = 0; s.ky = 1; }
      stepGait(s, p, FIXED_DT);
      const d0 = Math.hypot(s.feet[0].x - p.x, s.feet[0].y - p.y);
      expect(d0, `state=${state}`).toBeLessThan(3);
    }
  });

  it("catch-up bursts (the live dt cap, 0.05s) keep feet bounded through a sprint", () => {
    const s = mkOne();
    const p = { x: 50, y: 50 };
    for (let i = 0; i < 200; i++) {
      p.y += 18 * 0.05; // full sprint
      updateSkelVel(s, { ...p }, { x: p.x, y: p.y - 18 * 0.05 }, 1 / 0.05);
      stepGait(s, p, 0.05);
      for (const f of s.feet) expect(Math.hypot(f.x - p.x, f.y - p.y)).toBeLessThan(6);
    }
  });

  it("capFootReach is anisotropic: a screen-x stride at anatomical reach is NOT clamped, a screen-y overreach IS", () => {
    const hip = { x: 100, y: 100 };
    const maxLeg = 16;
    // horizontal: field-equivalent reach allows maxLeg/0.62 screen-x px
    const wide = { x: 100 + (maxLeg / 0.62) * 0.99, y: 100 };
    expect(capFootReach(hip, wide, maxLeg)).toEqual(wide);
    // vertical: maxLeg is calibrated on the drawn vertical leg — anything past it clamps
    const long = { x: 100, y: 100 + maxLeg * 1.2 };
    const capped = capFootReach(hip, long, maxLeg);
    expect(Math.hypot((capped.x - hip.x) * 0.62, capped.y - hip.y)).toBeCloseTo(maxLeg, 5);
    expect(capped.y - hip.y).toBeLessThan(maxLeg * 1.01);
  });
});
