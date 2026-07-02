// CALIBRATION GATES — the sim's stats must live in real-football bands.
//
// RE-ANCHORED AT THE 3-MINUTE CLOCK (2026-07-02, SECS_PER_MATCH 60 → 180): the 60s
// clock was the volume-starver all along — at 30× compression build-ups complete, so
// shots/corners/0-0 fixed themselves and the re-tune was mostly DAMPING (foul + card
// + conversion rates, shot appetite, a much stricter through-on-goal test — the old
// one supplied HALF of all shots from wide/far positions). RATIOS are real:
// P(goal|shot) ≈ 0.10-0.11 (real ~0.11), on-target ≈ 0.37 (real ~35-40%),
// P(goal|on-target) ≈ 0.28 (real ~0.30), fouls/cards/pens/0-0 all in-band.
//
// KNOWN RESIDUAL (do not knob it away): shot VOLUME ~16/team vs real ~12.5, and
// goals ride it (~3.4 vs real ~2.7). Instrumentation showed the demand is
// structural — the defence concedes ~30 high-value positions/match because a beaten
// line stays beaten (no recovery pace / turn physics / reaction lag yet). Tightening
// one shot source just routes the same positions through another. The kinematics
// commit changes chase/recovery fundamentally; re-anchor volume THERE, with
// mechanics, exactly as the 60s arc raised it with mechanics. Suppressing shots
// from genuinely great positions would be a new artifact, not realism.
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

  it("goals per match (real ~2.7; rides the volume residual): mean in [2.4, 4.2]", () => {
    expect(mean(agg.goals)).toBeGreaterThanOrEqual(2.4);
    expect(mean(agg.goals)).toBeLessThanOrEqual(4.2); // comes down with the kinematics volume fix
  }, SLOW);

  it("shots per team ≈ real (~12.5; known ~16 residual): mean in [12, 20]", () => {
    // At 180s volume flipped from starved (~7-8 at 60s) to ~30% HIGH (~16): the
    // defence concedes too many high-value positions without recovery pace. The
    // ceiling stops regression; the kinematics commit brings the mean down with
    // mechanics, then this band narrows toward [9.5, 15.5].
    expect(mean(agg.shotsPerTeam)).toBeGreaterThanOrEqual(12);
    expect(mean(agg.shotsPerTeam)).toBeLessThanOrEqual(20);
  }, SLOW);

  it("shots on target ≈ real (~35% of all shots): fraction in [0.28, 0.5]", () => {
    // was 92.5% before the aim-error tune — every unblocked shot hit the frame
    expect(mean(agg.onTargetFrac)).toBeGreaterThanOrEqual(0.28);
    expect(mean(agg.onTargetFrac)).toBeLessThanOrEqual(0.5);
  }, SLOW);

  it("corners ≈ real-ish (real ~10, measured ~4.3): mean in [2.5, 11]", () => {
    // the 180s clock tripled the 60s-era ~1.7 (more play = more clearances behind);
    // the rest of the gap comes with Magnus crosses + deflections, not knobs.
    expect(mean(agg.corners)).toBeGreaterThanOrEqual(2.5);
    expect(mean(agg.corners)).toBeLessThanOrEqual(11);
  }, SLOW);

  it("fouls per match ≈ real (~22): mean in [15, 26]", () => {
    expect(mean(agg.fouls)).toBeGreaterThanOrEqual(15);
    expect(mean(agg.fouls)).toBeLessThanOrEqual(26);
  }, SLOW);

  it("yellow cards ≈ real (~3.5-4.5): mean in [2.0, 5.0]; reds rare (≤ 0.45)", () => {
    expect(mean(agg.yellows)).toBeGreaterThanOrEqual(2.0);
    expect(mean(agg.yellows)).toBeLessThanOrEqual(5.0);
    expect(mean(agg.reds)).toBeLessThanOrEqual(0.45);
  }, SLOW);

  it("0-0 stays uncommon (real ~8%; the hot economy runs lower): at most 12%", () => {
    expect(agg.zeroZero / N).toBeLessThanOrEqual(0.12);
  }, SLOW);

  it("penalties happen but stay rare (real ~0.3/match): mean in [0.05, 0.7]", () => {
    expect(mean(agg.pens)).toBeGreaterThanOrEqual(0.05);
    expect(mean(agg.pens)).toBeLessThanOrEqual(0.7);
  }, SLOW);

  it("goal timing has no LATE DIP and leans late (the audit artifact stays dead)", () => {
    // the audit found goals DIPPING late (13.4% in 76-90' vs real ~24%, late < first).
    // Drivers now in: urgency (chase/protect/draw risk-on), the fatigue fade (tackles,
    // reach, stray passes, conversion), thrown-forward fullbacks, committed runs, the
    // cagey opening, the coach brain's chase/shell, early through-balls ramping with
    // settled(). Systematic late-third ≈ 28-32%; real no-stoppage is ~35% — the
    // residual gap IS stoppage time + fresh-legged substitutes, which a fixed-step
    // no-subs sim does not model. The gate pins the SHAPE (no dip, leans late), not a
    // share the model structurally cannot reach — do not juice conversion to fake it.
    //
    // FRONT-LOAD TOLERANCE re-anchored at the 3-min clock: measured systematic lean
    // is ~7-9pp front (was ~6pp at 60s — the longer clock completes early build-ups
    // too). Three tuning passes moved it ±2pp inside seed noise; the bound's job is
    // stopping REGRESSION (a 45/25 split still fails), the dip asserts carry the
    // audit artifact. Kinematics (recovery pace, derived stamina) owns narrowing it.
    const total = agg.goalMinutes.length;
    const late = agg.goalMinutes.filter((m) => m >= 61).length;
    const first = agg.goalMinutes.filter((m) => m <= 30).length;
    const finalBucket = agg.goalMinutes.filter((m) => m >= 76).length;
    expect(total).toBeGreaterThan(150); // enough sample to judge the shape
    expect(late / total).toBeGreaterThanOrEqual(0.28);
    expect(late).toBeGreaterThanOrEqual(first - Math.ceil(total * 0.105)); // bounded front-load (see header note)
    expect(finalBucket / total).toBeGreaterThanOrEqual(0.13); // the 76-90' dip stays dead
  }, SLOW);
});
