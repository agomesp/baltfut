// CALIBRATION GATES — the sim's stats must live in real-football bands.
//
// RE-CERTIFIED AT THE CLOSEOUT (2026-07-03) after the keeper-free-kick freeze fix:
// 22 of these 150 seeds used to contain frozen spans of 14-166s (foul() handed the
// free kick to the KEEPER, whose line-keeping never walked to the ball, so the
// referee-wait pinned the match). Every earlier number certified on this range was
// measured on a partially-dead distribution — including a "front-loaded goal
// timing" artifact that was really dead matches not scoring late. The freeze-scan
// regression test (freeze-scan.test.ts) keeps the three worst seeds honest.
//
// THE ECONOMY AT HEAD (N=150, seedBases 1000 & 5000): goals 3.30/3.39 (real ~2.7),
// shots/team 15.0/14.9 (real ~12.5), on-target 0.40/0.41 (real ~0.35-0.40),
// P(goal|shot) ≈ 0.11 (real ~0.11), corners ~3.9 (real ~10), fouls ~24 (real ~22),
// yellows 3.9 (real ~3.5-4.5), reds 0.15/0.25 (real ~0.2), pens 0.45/0.55 (real
// ~0.3), 0-0 3% (real ~8%), timing flat-to-late with a dead 76-90' dip.
//
// KNOWN RESIDUAL (do not knob it away): BREAKAWAY SUPPLY. Source instrumentation
// (closeout) put clear-through shots at ~7/match (real 1-3) — that is the whole
// volume+goals excess. Three definitional tightenings and a run-start man-tracking
// trigger were tried; the definitional margins don't bind (a through runner has
// 10+ units on a beaten line) and early man-tracking measurably BACKFIRED
// (defenders chased feints, kept runners onside). What ships: goalside-only
// runner tracking. The honest fix is coordinated marking + offside-trap
// discipline — a named future mechanic. Suppressing shots from genuinely great
// positions, or cutting conversion below its calibration, would fake the shape.
//
// The open-play xG→goal reference is 0.66 (recalibrated against this arc's shot
// mix; penalties own a separate real-anchored 0.82-on-target conversion), and the
// late-conversion factor is back at its honest 0.12 — the 0.16 juicing existed to
// fight the freeze artifact.
//
// Bands are deliberately WIDE, asserted over 150 seeded matches (cross-checked at
// seedBase 5000) — they gate the DISTRIBUTION, not a lucky seed.
import { describe, it, expect } from "vitest";
import { createMatchSim, type PitchResult } from "./match-sim";
import { autoLineup, fieldLayout } from "./squad";
import { mockField } from "./tournament";
import { TOTAL_STEPS, FIXED_DT } from "./sim-timing";

const SLOW = 60_000;
const N = 150; // big enough that per-gate seed noise (sigma ~2pp on shares) stops flapping the bands

interface Agg {
  goals: number[];
  goalMinutes: number[];
  shotsPerTeam: number[];
  onTargetFrac: number[];
  corners: number[];
  fouls: number[];
  pens: number[];
  yellows: number[];
  reds: number[];
  zeroZero: number;
}

function playN(n: number, seedBase: number): Agg {
  const field = mockField();
  const home = fieldLayout(field[0], autoLineup(field[0], "4-4-2", {}), "home");
  const away = fieldLayout(field[1], autoLineup(field[1], "4-3-3", {}), "away");
  const agg: Agg = { goals: [], goalMinutes: [], shotsPerTeam: [], onTargetFrac: [], corners: [], fouls: [], pens: [], yellows: [], reds: [], zeroZero: 0 };
  for (let k = 0; k < n; k++) {
    const sim = createMatchSim(home, away, seedBase + k, { scoring: true });
    for (let i = 0; i < TOTAL_STEPS; i++) sim.step(FIXED_DT);
    const r: PitchResult = sim.getResult();
    const total = r.goals.home + r.goals.away;
    agg.goals.push(total);
    if (total === 0) agg.zeroZero++;
    const shots = r.stats.shots.home + r.stats.shots.away;
    agg.shotsPerTeam.push(shots / 2);
    const onT = r.stats.onTarget.home + r.stats.onTarget.away;
    if (shots > 0) agg.onTargetFrac.push(onT / shots);
    agg.corners.push(r.stats.corners.home + r.stats.corners.away);
    agg.fouls.push(r.stats.fouls.home + r.stats.fouls.away);
    agg.pens.push(r.stats.pens.home + r.stats.pens.away);
    agg.yellows.push(r.events.filter((e) => e.type === "yellow").length);
    agg.reds.push(r.events.filter((e) => e.type === "red").length);
    for (const e of r.events) if (e.type === "goal") agg.goalMinutes.push(e.minute);
  }
  return agg;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("calibration — the sim's match stats live in real-football bands", () => {
  // one shared 150-match run for every gate (they inspect different stats of it)
  const agg = playN(N, 1000);

  it("goals per match (real ~2.7; measured 3.3 — rides the breakaway residual): mean in [2.6, 4.0]", () => {
    expect(mean(agg.goals)).toBeGreaterThanOrEqual(2.6);
    expect(mean(agg.goals)).toBeLessThanOrEqual(4.0); // narrows when coordinated marking lands
  }, SLOW);

  it("shots per team ≈ real (~12.5; measured ~15): mean in [11.5, 17.5]", () => {
    // the excess IS the breakaway residual (see header) — the band stops regression
    // both ways and narrows toward [9.5, 15.5] when the marking mechanic lands
    expect(mean(agg.shotsPerTeam)).toBeGreaterThanOrEqual(11.5);
    expect(mean(agg.shotsPerTeam)).toBeLessThanOrEqual(17.5);
  }, SLOW);

  it("shots on target ≈ real (~35-40% of all shots): fraction in [0.30, 0.50]", () => {
    // was 92.5% before the aim-error tune — every unblocked shot hit the frame
    expect(mean(agg.onTargetFrac)).toBeGreaterThanOrEqual(0.3);
    expect(mean(agg.onTargetFrac)).toBeLessThanOrEqual(0.5);
  }, SLOW);

  it("corners ≈ real-ish (real ~10, measured ~3.9): mean in [2.5, 11]", () => {
    // 60s-era ~1.7 → ~3.9 (more play + Magnus deliveries + deflections). The rest of
    // the gap needs more crossing volume — build-up width, not a knob.
    expect(mean(agg.corners)).toBeGreaterThanOrEqual(2.5);
    expect(mean(agg.corners)).toBeLessThanOrEqual(11);
  }, SLOW);

  it("fouls per match ≈ real (~22, measured ~24): mean in [17, 27]", () => {
    expect(mean(agg.fouls)).toBeGreaterThanOrEqual(17);
    expect(mean(agg.fouls)).toBeLessThanOrEqual(27);
  }, SLOW);

  it("yellow cards ≈ real (~3.5-4.5, measured 3.9): mean in [2.4, 5.4]; reds rare (≤ 0.5)", () => {
    expect(mean(agg.yellows)).toBeGreaterThanOrEqual(2.4);
    expect(mean(agg.yellows)).toBeLessThanOrEqual(5.4);
    expect(mean(agg.reds)).toBeLessThanOrEqual(0.5); // measured 0.15-0.25 (real ~0.2)
  }, SLOW);

  it("0-0 stays uncommon (real ~8%; the hot economy runs ~3%): at most 12%", () => {
    expect(agg.zeroZero / N).toBeLessThanOrEqual(0.12);
  }, SLOW);

  it("penalties happen but stay rare (real ~0.3/match, measured ~0.5): mean in [0.1, 0.8]", () => {
    // pen SUPPLY rides the same residual (more box entries = more box fouls); the
    // in-box whistle damp (0.14) keeps it from tripling like the raw challenge rate
    expect(mean(agg.pens)).toBeGreaterThanOrEqual(0.1);
    expect(mean(agg.pens)).toBeLessThanOrEqual(0.8);
  }, SLOW);

  it("goal timing has no LATE DIP and no front-load (the audit artifacts stay dead)", () => {
    // TWO buried artifacts live here. (1) The original audit found goals DIPPING
    // late (13.4% in 76-90'; real ~24%) — urgency, the fatigue fade, committed runs
    // and the coach brain fixed it mechanically. (2) The 180s re-tune then measured
    // a ~10pp FRONT-load and widened this tolerance to 10.5pp blaming the clock —
    // wrong: the freeze bug was silencing late play (dead matches score early or
    // never). Post-fix the lean measures ~6pp (base 1000) / ~0pp (base 5000), so
    // the tolerance is back at 7.5pp. Real no-stoppage late-third is ~35%; the
    // residual gap IS stoppage time + fresh substitutes, which a fixed-step no-subs
    // sim does not model. Pin the SHAPE — never juice conversion to fake a share.
    const total = agg.goalMinutes.length;
    const late = agg.goalMinutes.filter((m) => m >= 61).length;
    const first = agg.goalMinutes.filter((m) => m <= 30).length;
    const finalBucket = agg.goalMinutes.filter((m) => m >= 76).length;
    expect(total).toBeGreaterThan(150); // enough sample to judge the shape
    expect(late / total).toBeGreaterThanOrEqual(0.27); // measured 0.30/0.33
    expect(late).toBeGreaterThanOrEqual(first - Math.ceil(total * 0.075)); // measured lean ~6pp/0pp
    expect(finalBucket / total).toBeGreaterThanOrEqual(0.12); // measured 0.15 — the 76-90' dip stays dead
  }, SLOW);
});
