// REGRESSION — the keeper-free-kick deadlock (closeout review, 2026-07-03).
// foul() used to hand the free kick to the nearest TEAMMATE, which near the box is
// often the KEEPER; target()'s Goleiro branch returned him to his line before the
// dead-ball "walk to the ball" branch could run, so the referee-wait clamp pinned
// decideT forever and the match froze. 22 of the 150 gated seeds carried frozen
// spans of 14-166s (seed 1111: 165.8s of a 180s match) — the three worst are the
// canaries here. Legit ceremonies (pen ~2.8s + walk, corner ~1.6s + walk) stay
// well under the 8s bound.
import { describe, it, expect } from "vitest";
import { createMatchSim } from "./match-sim";
import { autoLineup, fieldLayout } from "./squad";
import { mockField } from "./tournament";
import { TOTAL_STEPS, FIXED_DT } from "./sim-timing";

const WORST_SEEDS = [1111, 1056, 1120]; // 165.8s / 162.2s / 161.8s frozen pre-fix

describe("no frozen matches — every dead ball restarts", () => {
  it.each(WORST_SEEDS)("seed %i never pins the ball longer than a real ceremony", (seed) => {
    const field = mockField();
    const home = fieldLayout(field[0], autoLineup(field[0], "4-4-2", {}), "home");
    const away = fieldLayout(field[1], autoLineup(field[1], "4-3-3", {}), "away");
    const sim = createMatchSim(home, away, seed, { scoring: true });
    let lastX = -1, lastY = -1, run = 0, maxRun = 0;
    for (let i = 0; i < TOTAL_STEPS; i++) {
      sim.step(FIXED_DT);
      const b = sim.snapshot().ball;
      if (b.x === lastX && b.y === lastY) { run += 1; if (run > maxRun) maxRun = run; }
      else { run = 0; lastX = b.x; lastY = b.y; }
    }
    expect(maxRun * FIXED_DT).toBeLessThan(8);
  }, 60_000);
});
