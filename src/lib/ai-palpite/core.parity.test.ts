import { describe, expect, it } from "vitest";
// The app's canonical TS model…
import { teamPower as teamPowerTs, isRated as isRatedTs, BASE_POWER as BASE_TS } from "@/lib/ai-palpite/power";
import { predictScore as predictScoreTs, strongerCode as strongerCodeTs } from "@/lib/ai-palpite/predict";
// …vs the Node-importable copy the cron script runs.
import {
  POWER,
  BASE_POWER as BASE_MJS,
  teamPower as teamPowerMjs,
  isRated as isRatedMjs,
  predictScore as predictScoreMjs,
  strongerCode as strongerCodeMjs,
} from "@/lib/ai-palpite/core.mjs";

// Guardrail: core.mjs is a duplicate of power.ts + predict.ts so Node can run the
// model. This proves the copy never drifts — if someone edits one table/formula
// and not the other, CI goes red here.
describe("core.mjs ⇄ app model parity", () => {
  const codes = [...Object.keys(POWER), "XYZ", "ZZZ", "TBD"]; // rated + fallbacks

  it("BASE_POWER matches", () => {
    expect(BASE_MJS).toBe(BASE_TS);
  });

  it("teamPower + isRated match for every code", () => {
    for (const code of codes) {
      expect(teamPowerMjs(code)).toBe(teamPowerTs(code));
      expect(isRatedMjs(code)).toBe(isRatedTs(code));
    }
  });

  it("predictScore matches across the rating grid", () => {
    for (let h = 55; h <= 92; h += 3) {
      for (let a = 55; a <= 92; a += 3) {
        expect(predictScoreMjs(h, a)).toEqual(predictScoreTs(h, a));
      }
    }
  });

  it("strongerCode matches for real pairings", () => {
    for (const x of codes) {
      for (const y of codes) {
        expect(strongerCodeMjs(x, y)).toBe(strongerCodeTs(x, y));
      }
    }
  });
});
