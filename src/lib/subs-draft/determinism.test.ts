// A0 keystone — the sim is a pure function of its seed.
//
// This is the property the whole roadmap leans on: replays, a shared watch-along
// (broadcast the seed, not every frame), and reproducible bug reports all reduce
// to "same seed → same match". These tests pin that down, and also guard that the
// DEFAULT (no seed) stays random so nothing was accidentally frozen.
import { describe, it, expect } from "vitest";
import { createMatchSim } from "./match-sim";
import { autoLineup, fieldLayout } from "./squad";
import { simulateMatch, buildBracket, mockField } from "./tournament";
import { CATS, type Player } from "./data";

const field = mockField();
const homeSlots = fieldLayout(field[0], autoLineup(field[0], "4-4-2", {}), "home");
const awaySlots = fieldLayout(field[1], autoLineup(field[1], "4-3-3", {}), "away");
const xi = (i: number): Player[] => CATS.flatMap((c) => field[i].roster[c]).slice(0, 11);

/** A compact digest of the on-screen state after many ticks — positions, ball,
 * possession, shots, bookings, the events counter. Two runs match iff every frame
 * evolved identically. */
function fingerprint(seed: number, steps = 1500): string {
  const sim = createMatchSim(homeSlots, awaySlots, seed);
  for (let i = 0; i < steps; i++) sim.step(0.016, i / steps);
  const s = sim.snapshot();
  const r = (n: number) => Math.round(n * 100) / 100;
  return JSON.stringify({
    ball: [r(s.ball.x), r(s.ball.y)],
    home: s.home.map((p) => [r(p.x), r(p.y)]),
    away: s.away.map((p) => [r(p.x), r(p.y)]),
    shots: s.shots,
    poss: r(s.possHome),
    book: s.bookings,
    off: s.sentOff,
    seq: s.eventSeq,
  });
}

describe("A0 — seeded determinism", () => {
  it("createMatchSim: same seed replays an identical match", () => {
    expect(fingerprint(12345)).toBe(fingerprint(12345));
  });

  it("createMatchSim: different seeds diverge", () => {
    expect(fingerprint(1)).not.toBe(fingerprint(2));
  });

  it("simulateMatch: same seed → identical result (score, scorers, cards, pens)", () => {
    const a = simulateMatch(field[0], field[1], xi(0), xi(1), 777);
    const b = simulateMatch(field[0], field[1], xi(0), xi(1), 777);
    expect(b).toEqual(a);
  });

  it("simulateMatch: the seed drives the result", () => {
    const a = simulateMatch(field[0], field[1], xi(0), xi(1), 1);
    const b = simulateMatch(field[0], field[1], xi(0), xi(1), 424242);
    expect(b).not.toEqual(a);
  });

  it("buildBracket: same seed → identical seeding", () => {
    const ids = field.map((t) => t.id);
    expect(buildBracket(ids, 42)).toEqual(buildBracket(ids, 42));
  });

  it("buildBracket: the seed reshuffles the draw", () => {
    const ids = Array.from({ length: 32 }, (_, i) => `t${i}`);
    const draw = (seed: number) => buildBracket(ids, seed)[0].map((m) => [m.homeId, m.awayId]);
    expect(draw(2)).not.toEqual(draw(1));
  });

  it("unseeded calls stay random (no accidentally frozen seed)", () => {
    const a = simulateMatch(field[0], field[1], xi(0), xi(1));
    const b = simulateMatch(field[0], field[1], xi(0), xi(1));
    expect(b).not.toEqual(a);
  });
});
