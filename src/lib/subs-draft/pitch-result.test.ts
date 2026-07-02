import { describe, it, expect } from "vitest";
import { simulateMatchOnPitch, mockField, bracketMatchSeed, FULL_TIME } from "./tournament";
import { createMatchSim } from "./match-sim";
import { autoLineup, fieldLayout, startingPlayers } from "./squad";
import { TOTAL_STEPS, FIXED_DT } from "./sim-timing";

const field = mockField();
const A = field[0];
const B = field[1];
const la = autoLineup(A, "4-4-2", {});
const lb = autoLineup(B, "4-3-3", {});

describe("simulateMatchOnPitch — the scoreline comes from a headless pitch run", () => {
  it("is deterministic: the same seed replays the identical result", () => {
    expect(simulateMatchOnPitch(A, B, la, lb, 7)).toEqual(simulateMatchOnPitch(A, B, la, lb, 7));
    expect(simulateMatchOnPitch(A, B, la, lb, 40, { allowDraw: true })).toEqual(
      simulateMatchOnPitch(A, B, la, lb, 40, { allowDraw: true }),
    );
  });

  it("matches goal-for-goal what the LIVE pitch will produce for that seed (Stage 3 fidelity)", () => {
    // The whole point of unification: a precomputed result and the live spotlight are
    // the SAME simulation. Rebuild the slots from the same lineup and run the sim
    // directly — its goals must equal the tournament result's.
    for (const seed of [3, 11, 88]) {
      const r = simulateMatchOnPitch(A, B, la, lb, seed);
      const sim = createMatchSim(fieldLayout(A, la, "home"), fieldLayout(B, lb, "away"), seed, { scoring: true });
      for (let i = 0; i < TOTAL_STEPS; i++) sim.step(FIXED_DT);
      const live = sim.getResult();
      expect({ home: r.homeGoals, away: r.awayGoals }).toEqual(live.goals);
    }
  });

  it("never draws a knockout: level regulation goes to penalties, and someone always wins", () => {
    let shootouts = 0;
    for (let seed = 0; seed < 60; seed++) {
      const r = simulateMatchOnPitch(A, B, la, lb, seed); // no allowDraw
      expect(r.winnerId === A.id || r.winnerId === B.id).toBe(true);
      if (r.homeGoals === r.awayGoals) {
        expect(r.pens).not.toBeNull();
        expect(r.pens!.home).not.toBe(r.pens!.away);
        shootouts++;
      } else {
        expect(r.pens).toBeNull();
      }
    }
    expect(shootouts).toBeGreaterThan(0); // some ties did occur and were decided on pens
  }, 60_000); // 60 full matches at the 3-min clock (~10800 steps each)

  it("allows draws in the group stage (no shootout, empty winner)", () => {
    let draws = 0;
    for (let seed = 0; seed < 60; seed++) {
      const r = simulateMatchOnPitch(A, B, la, lb, seed, { allowDraw: true });
      if (r.homeGoals === r.awayGoals) {
        expect(r.winnerId).toBe("");
        expect(r.pens).toBeNull();
        draws++;
      }
    }
    expect(draws).toBeGreaterThan(0);
  }, 60_000);

  it("events reference only the two teams' real players, at sane minutes", () => {
    const ids = new Set([...startingPlayers(A, la), ...startingPlayers(B, lb)].map((p) => p.id));
    for (let seed = 0; seed < 20; seed++) {
      const r = simulateMatchOnPitch(A, B, la, lb, seed);
      for (const e of r.events) {
        expect(e.teamId === A.id || e.teamId === B.id).toBe(true);
        expect(e.minute).toBeGreaterThanOrEqual(1);
        expect(e.minute).toBeLessThanOrEqual(FULL_TIME);
        expect(ids.has(e.playerId)).toBe(true);
      }
    }
  }, 30_000);

  it("injuries can occur, on the salted side stream (independent of the scoreline seed)", () => {
    let injuries = 0;
    for (let seed = 0; seed < 40; seed++) {
      injuries += simulateMatchOnPitch(A, B, la, lb, seed).events.filter((e) => e.type === "injury").length;
    }
    expect(injuries).toBeGreaterThan(0);
  }, 30_000);

  it("a stronger squad wins the tie more often across seeds", () => {
    const strong = field.reduce((best, t) => (avg(t) > avg(best) ? t : best), field[0]);
    const weak = field.reduce((worst, t) => (avg(t) < avg(worst) ? t : worst), field[0]);
    const ls = autoLineup(strong, "4-3-3", {});
    const lw = autoLineup(weak, "4-4-2", {});
    let strongWins = 0;
    let weakWins = 0;
    // N=60: the measured edge is ~65/35 (200-match probe: 130-70, goals 1.57 vs
    // 1.09) — at N=24 a fixed-seed run could legitimately TIE 12-12; at 60 it can't.
    for (let k = 0; k < 60; k++) {
      const r = simulateMatchOnPitch(strong, weak, ls, lw, bracketMatchSeed(2026, 0, k));
      if (r.winnerId === strong.id) strongWins++;
      else if (r.winnerId === weak.id) weakWins++;
    }
    expect(strongWins).toBeGreaterThan(weakWins);
  }, 60_000);
});

function avg(t: (typeof field)[number]): number {
  const ps = t.roster ? Object.values(t.roster).flat() : [];
  return ps.length ? ps.reduce((s, p) => s + p.rating, 0) / ps.length : 70;
}
