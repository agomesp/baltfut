// GAIT INTEGRITY — headless reproduction of the render pipeline: run the REAL sim,
// derive per-frame velocities exactly like the pump's updVel, drive stepGait, and
// assert feet never stream away from bodies (the "shin streak" artifact). This is
// the deterministic harness for a bug that was only visible in screenshots.
import { describe, it, expect } from "vitest";
import { stepGait, type Skel } from "./pitch-view";
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

describe("gait integrity — feet stay under bodies through kinematic movement", () => {
  it("max foot-body distance stays bounded over 3600 frames (60s of play)", () => {
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
          const q = pv[k];
          const invStep = 1 / FIXED_DT;
          const vx = q ? (p.x - q.x) * invStep : 0;
          const vy = q ? (p.y - q.y) * invStep : 0;
          if (q && Math.hypot(p.x - q.x, p.y - q.y) > 8) { s.feet = [{ x: p.x - 1.1, y: p.y }, { x: p.x + 1.1, y: p.y }]; s.vx = 0; s.vy = 0; s.swing = -1; return; }
          const nax = (vx - s.vx) * invStep, nay = (vy - s.vy) * invStep;
          s.ax += (nax - s.ax) * 0.2; s.ay += (nay - s.ay) * 0.2;
          s.vx += (vx - s.vx) * 0.35; s.vy += (vy - s.vy) * 0.35;
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
    expect(maxDist).toBeLessThan(8);
  }, 120_000);
});
