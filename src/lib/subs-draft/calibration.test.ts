// CALIBRATION GATES — the sim's stats must live in real-football bands.
//
// The empirical audit (2026-07-02) caught the sim drifting into a parallel sport:
// ZERO corners in 60 matches (shots never missed the frame → nothing crossed the
// byline), 92.5% shots on target (real ~35%), 6.4 fouls (real ~22), goals DIPPING
// late. These gates pin the bands so every behavior mechanic (counters, urgency,
// runs, presses…) lands measurably inside football. Bands are deliberately WIDE and
// asserted over 60 seeded matches — they gate the DISTRIBUTION, not a lucky seed.
import { describe, it, expect } from "vitest";
import { createMatchSim, type PitchResult } from "./match-sim";
import { autoLineup, fieldLayout } from "./squad";
import { mockField } from "./tournament";
import { TOTAL_STEPS, FIXED_DT } from "./sim-timing";

const SLOW = 60_000;
const N = 60;

interface Agg {
  goals: number[];
  shotsPerTeam: number[];
  onTargetFrac: number[];
  corners: number[];
  fouls: number[];
  yellows: number[];
  reds: number[];
  zeroZero: number;
}

function playN(n: number, seedBase: number): Agg {
  const field = mockField();
  const home = fieldLayout(field[0], autoLineup(field[0], "4-4-2", {}), "home");
  const away = fieldLayout(field[1], autoLineup(field[1], "4-3-3", {}), "away");
  const agg: Agg = { goals: [], shotsPerTeam: [], onTargetFrac: [], corners: [], fouls: [], yellows: [], reds: [], zeroZero: 0 };
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
    agg.yellows.push(r.events.filter((e) => e.type === "yellow").length);
    agg.reds.push(r.events.filter((e) => e.type === "red").length);
  }
  return agg;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("calibration — the sim's match stats live in real-football bands", () => {
  // one shared 60-match run for every gate (they inspect different stats of it)
  const agg = playN(N, 1000);

  it("goals per match ≈ real (~2.7): mean in [1.9, 3.2]", () => {
    expect(mean(agg.goals)).toBeGreaterThanOrEqual(1.9);
    expect(mean(agg.goals)).toBeLessThanOrEqual(3.2);
  }, SLOW);

  it("shots per team ≈ real (~12): mean in [8.3, 14.5]", () => {
    // Volume is SUPPLY-limited, not appetite-limited: extra shots need extra final-third
    // entries. The counter-attack window lifted the mean 7.9 → 8.8 (its predicted
    // mechanism); committed runs (tier 2) add more — tighten toward 9.5+ then. Do not
    // crank the shoot appetite instead (players shooting from silly spots to please a band).
    expect(mean(agg.shotsPerTeam)).toBeGreaterThanOrEqual(8.3);
    expect(mean(agg.shotsPerTeam)).toBeLessThanOrEqual(14.5);
  }, SLOW);

  it("shots on target ≈ real (~35% of all shots): fraction in [0.26, 0.55]", () => {
    // was 92.5% before the aim-error tune — every unblocked shot hit the frame
    expect(mean(agg.onTargetFrac)).toBeGreaterThanOrEqual(0.26);
    expect(mean(agg.onTargetFrac)).toBeLessThanOrEqual(0.55);
  }, SLOW);

  it("corners exist (were ZERO in 60 matches): mean in [1.5, 11]", () => {
    // real ~10; parried-behind + deflected-behind sources give ~3-5 now, cleared
    // crosses (tier-2 aerial duels) add the rest — the band tightens then.
    expect(mean(agg.corners)).toBeGreaterThanOrEqual(1.5);
    expect(mean(agg.corners)).toBeLessThanOrEqual(11);
  }, SLOW);

  it("fouls per match ≈ real (~22): mean in [11, 26]", () => {
    expect(mean(agg.fouls)).toBeGreaterThanOrEqual(11);
    expect(mean(agg.fouls)).toBeLessThanOrEqual(26);
  }, SLOW);

  it("yellow cards ≈ real (~3.5-4.5): mean in [2.0, 5.5]; reds rare (≤ 0.6)", () => {
    expect(mean(agg.yellows)).toBeGreaterThanOrEqual(2.0);
    expect(mean(agg.yellows)).toBeLessThanOrEqual(5.5);
    expect(mean(agg.reds)).toBeLessThanOrEqual(0.6);
  }, SLOW);

  it("0-0 stays uncommon (real ~8%): at most 20% of matches", () => {
    expect(agg.zeroZero / N).toBeLessThanOrEqual(0.2);
  }, SLOW);
});
