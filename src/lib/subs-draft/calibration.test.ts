// CALIBRATION GATES — the sim's stats must live in real-football bands.
//
// RE-ANCHORED (2026-07-02) after the adversarial-review fix batch: the corner-defence
// inversion, dead-ball foul chains, and a keeper-positioning quirk were quietly
// SUPPLYING ~1 goal/match of fake production, and the original bands were calibrated
// on top of them. Post-fix the economy's RATIOS are real — P(goal|shot) ≈ 0.11 (real
// ~0.11), on-target ≈ 40% (real ~35-40%), P(goal|on-target) ≈ 0.27 (real ~0.30) — and
// only VOLUME is low (shots ~7/team vs real ~12), which is the documented build-up-
// depth gap. Bands sit at the honest levels; raise them WITH mechanics, not knobs.
//
// The empirical audit (2026-07-02) caught the sim drifting into a parallel sport:
// ZERO corners in 60 matches (shots never missed the frame → nothing crossed the
// byline), 92.5% shots on target (real ~35%), 6.4 fouls (real ~22), goals DIPPING
// late. These gates pin the bands so every behavior mechanic (counters, urgency,
// runs, presses…) lands measurably inside football. Bands are deliberately WIDE and
// asserted over 150 seeded matches — they gate the DISTRIBUTION, not a lucky seed.
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
  // one shared 60-match run for every gate (they inspect different stats of it)
  const agg = playN(N, 1000);

  it("goals per match (real ~2.7; honest low-volume ~1.3-1.8): mean in [1.2, 3.2]", () => {
    expect(mean(agg.goals)).toBeGreaterThanOrEqual(1.2); // cross-seed-base floor (base 5000 measures 1.25)
    expect(mean(agg.goals)).toBeLessThanOrEqual(3.2);
  }, SLOW);

  it("shots per team ≈ real (~12): mean in [6.3, 14.5]", () => {
    // Volume is SUPPLY-limited, not appetite-limited: extra shots need extra final-third
    // entries, not a cranked shoot score. History of this floor: counters lifted 7.9 →
    // 8.8; the aerial-honesty pass (duels + z-gates + real flight time) then removed
    // ~0.7/team of FICTION (uncontested auto-headers, balls "caught" 8 units overhead)
    // — bisected, not guessed. 8.1 honest beats 8.8 fake; the road to the real ~12 is
    // deeper build-up mechanics, and this floor stops regression meanwhile.
    expect(mean(agg.shotsPerTeam)).toBeGreaterThanOrEqual(6.3); // cross-seed-base floor
    expect(mean(agg.shotsPerTeam)).toBeLessThanOrEqual(14.5);
  }, SLOW);

  it("shots on target ≈ real (~35% of all shots): fraction in [0.26, 0.55]", () => {
    // was 92.5% before the aim-error tune — every unblocked shot hit the frame
    expect(mean(agg.onTargetFrac)).toBeGreaterThanOrEqual(0.26);
    expect(mean(agg.onTargetFrac)).toBeLessThanOrEqual(0.55);
  }, SLOW);

  it("corners exist (were ZERO in the audit): mean in [1.5, 11]", () => {
    // real ~10; measured ~1.7-2 from parry-behind/deflect-behind/head-behind sources
    // — the band floor documents existence, not sufficiency; more corner sources come
    // with build-up depth (more crosses = more clearances behind).
    expect(mean(agg.corners)).toBeGreaterThanOrEqual(1.5);
    expect(mean(agg.corners)).toBeLessThanOrEqual(11);
  }, SLOW);

  it("fouls per match ≈ real (~22): mean in [9.5, 26]", () => {
    expect(mean(agg.fouls)).toBeGreaterThanOrEqual(9.5);
    expect(mean(agg.fouls)).toBeLessThanOrEqual(26);
  }, SLOW);

  it("yellow cards ≈ real (~3.5-4.5): mean in [1.6, 5.5]; reds rare (≤ 0.6)", () => {
    expect(mean(agg.yellows)).toBeGreaterThanOrEqual(1.6);
    expect(mean(agg.yellows)).toBeLessThanOrEqual(5.5);
    expect(mean(agg.reds)).toBeLessThanOrEqual(0.6);
  }, SLOW);

  it("0-0 stays uncommon (real ~8%; low-volume economy runs higher): at most 30%", () => {
    expect(agg.zeroZero / N).toBeLessThanOrEqual(0.3); // cross-seed-base ceiling (base 5000 measures 29%)
  }, SLOW);

  it("penalties happen but stay rare (real ~0.3/match): mean in [0.05, 0.7]", () => {
    expect(mean(agg.pens)).toBeGreaterThanOrEqual(0.05);
    expect(mean(agg.pens)).toBeLessThanOrEqual(0.7);
  }, SLOW);

  it("goal timing has no LATE DIP and leans late (the audit artifact stays dead)", () => {
    // the audit found goals DIPPING late (13.4% in 76-90' vs real ~24%, late < first).
    // Drivers now in: urgency (chase/protect/draw risk-on), the fatigue fade (tackles,
    // reach, stray passes, conversion), thrown-forward fullbacks, committed runs, the
    // cagey opening. Systematic late-third ≈ 29-30%; real no-stoppage is ~35% — the
    // residual gap IS stoppage time + fresh-legged substitutes, which a fixed-3600-step
    // no-subs sim does not model. The gate pins the SHAPE (no dip, leans late), not a
    // share the model structurally cannot reach — do not juice conversion to fake it.
    const total = agg.goalMinutes.length;
    const late = agg.goalMinutes.filter((m) => m >= 61).length;
    const first = agg.goalMinutes.filter((m) => m <= 30).length;
    const finalBucket = agg.goalMinutes.filter((m) => m >= 76).length;
    expect(total).toBeGreaterThan(150); // enough sample to judge the shape
    expect(late / total).toBeGreaterThanOrEqual(0.28);
    expect(late).toBeGreaterThanOrEqual(first - Math.ceil(total * 0.075)); // bounded front-load: measured systematic lean ~6% (no subs/halftime/stoppage model); the bound stops REGRESSION, the dip asserts above carry the artifact
    expect(finalBucket / total).toBeGreaterThanOrEqual(0.13); // the 76-90' dip stays dead
  }, SLOW);
});
