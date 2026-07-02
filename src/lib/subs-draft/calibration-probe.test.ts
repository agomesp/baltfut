// DEV PROBE — not a gate. Prints the match-economy means so a tuning session can
// measure → adjust → re-measure without editing the calibration gates. Skipped in
// the normal suite; run it with:
//   PROBE=1 [PROBE_N=60] [PROBE_SEED=5000] npx vitest run src/lib/subs-draft/calibration-probe.test.ts
import { describe, it, expect } from "vitest";
import { createMatchSim, type PitchResult } from "./match-sim";
import { autoLineup, fieldLayout } from "./squad";
import { mockField } from "./tournament";
import { TOTAL_STEPS, FIXED_DT, SECS_PER_MATCH } from "./sim-timing";

const N = Number(process.env.PROBE_N ?? 40);
const SEED_BASE = Number(process.env.PROBE_SEED ?? 1000);

describe.runIf(process.env.PROBE)("probe: match-economy means (dev tool)", () => {
  it(`prints means over ${N} matches at seedBase ${SEED_BASE}`, () => {
    const field = mockField();
    const home = fieldLayout(field[0], autoLineup(field[0], "4-4-2", {}), "home");
    const away = fieldLayout(field[1], autoLineup(field[1], "4-3-3", {}), "away");
    let goals = 0, shots = 0, onT = 0, corners = 0, fouls = 0, pens = 0, yellows = 0, reds = 0, zz = 0;
    const minutes: number[] = [];
    const t0 = performance.now();
    for (let k = 0; k < N; k++) {
      const sim = createMatchSim(home, away, SEED_BASE + k, { scoring: true });
      for (let i = 0; i < TOTAL_STEPS; i++) sim.step(FIXED_DT);
      const r: PitchResult = sim.getResult();
      const g = r.goals.home + r.goals.away;
      goals += g;
      if (g === 0) zz++;
      shots += r.stats.shots.home + r.stats.shots.away;
      onT += r.stats.onTarget.home + r.stats.onTarget.away;
      corners += r.stats.corners.home + r.stats.corners.away;
      fouls += r.stats.fouls.home + r.stats.fouls.away;
      pens += r.stats.pens.home + r.stats.pens.away;
      yellows += r.events.filter((e) => e.type === "yellow").length;
      reds += r.events.filter((e) => e.type === "red").length;
      for (const e of r.events) if (e.type === "goal") minutes.push(e.minute);
    }
    const ms = (performance.now() - t0) / N;
    const line = (label: string, v: string) => process.stdout.write(`${label.padEnd(18)}${v}\n`);
    line("clock", `SECS_PER_MATCH=${SECS_PER_MATCH} steps=${TOTAL_STEPS} n=${N} seedBase=${SEED_BASE}`);
    line("goals/match", (goals / N).toFixed(2));
    line("shots/team", (shots / N / 2).toFixed(2));
    line("onTarget frac", shots ? (onT / shots).toFixed(2) : "n/a");
    line("corners/match", (corners / N).toFixed(2));
    line("fouls/match", (fouls / N).toFixed(2));
    line("pens/match", (pens / N).toFixed(2));
    line("yellows/match", `${(yellows / N).toFixed(2)}  reds ${(reds / N).toFixed(2)}`);
    line("0-0 rate", `${((zz / N) * 100).toFixed(0)}%`);
    const tot = minutes.length || 1;
    const share = (lo: number, hi: number) => `${((minutes.filter((m) => m >= lo && m <= hi).length / tot) * 100).toFixed(0)}%`;
    line("goal timing", `1-30' ${share(1, 30)}  31-60' ${share(31, 60)}  61-90' ${share(61, 90)}  (76-90' ${share(76, 90)})`);
    line("headless ms", ms.toFixed(1));
    expect(true).toBe(true);
  }, 600_000);
});
