import { describe, expect, it } from "vitest";
import { predictScore, predictMatch, strongerCode } from "@/lib/ai-palpite/predict";
import { teamPower } from "@/lib/ai-palpite/power";

describe("predictScore", () => {
  it("calls an even matchup a draw", () => {
    const s = predictScore(80, 80);
    expect(s.home).toBe(s.away);
    expect(s.winner).toBe("draw");
    expect(s.confidence).toBe(0);
  });

  it("favors the stronger side", () => {
    const s = predictScore(90, 65);
    expect(s.home).toBeGreaterThan(s.away);
    expect(s.winner).toBe("home");
    expect(s.confidence).toBeGreaterThan(0);
  });

  it("is symmetric: swapping powers mirrors the scoreline", () => {
    const a = predictScore(88, 70);
    const b = predictScore(70, 88);
    expect(b.home).toBe(a.away);
    expect(b.away).toBe(a.home);
    expect(b.winner).toBe("away");
  });

  it("never returns absurd or negative scorelines", () => {
    const blowout = predictScore(100, 0);
    expect(blowout.home).toBeLessThanOrEqual(5);
    expect(blowout.away).toBeGreaterThanOrEqual(0);
    expect(blowout.confidence).toBe(1);
  });

  it("is deterministic", () => {
    expect(predictScore(84, 71)).toEqual(predictScore(84, 71));
  });
});

describe("predictMatch", () => {
  it("backs the higher-rated code", () => {
    // BRA (89) vs HAI (58)
    const s = predictMatch("BRA", "HAI");
    expect(s.winner).toBe("home");
  });
});

describe("strongerCode", () => {
  it("returns the higher-power side", () => {
    expect(strongerCode("FRA", "NZL")).toBe("FRA");
    expect(strongerCode("NZL", "FRA")).toBe("FRA");
  });

  it("breaks an equal-power tie deterministically (alphabetical)", () => {
    // Two unrated teams share BASE_POWER.
    expect(teamPower("XYZ")).toBe(teamPower("ZZZ"));
    expect(strongerCode("ZZZ", "XYZ")).toBe("XYZ");
  });
});
