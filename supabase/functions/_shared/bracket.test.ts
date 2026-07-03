import { describe, it, expect } from "vitest";
import { validateBracket, MAX_PICKS } from "@shared/bracket";

const valid = {
  username: "  Allan  ",
  picks: { "0-0": "BRA", "1-0": "BRA", "4-0": "BRA" },
};

describe("validateBracket", () => {
  it("accepts a well-formed bracket and trims the name", () => {
    const r = validateBracket(valid);
    expect(r.success).toBe(true);
    expect(r.data?.username).toBe("Allan");
    expect(r.data?.picks["4-0"]).toBe("BRA");
    expect(r.errors).toBeUndefined();
  });

  it("rejects an invalid position key", () => {
    expect(validateBracket({ ...valid, picks: { "5-0": "BRA" } }).success).toBe(false); // round 5 doesn't exist
    expect(validateBracket({ ...valid, picks: { "0-16": "BRA" } }).success).toBe(false); // tie index > 15
  });

  it("rejects a malformed team code", () => {
    expect(validateBracket({ ...valid, picks: { "0-0": "brazil" } }).success).toBe(false);
    expect(validateBracket({ ...valid, picks: { "0-0": "b" } }).success).toBe(false);
  });

  it("rejects an empty pick set and an over-long one", () => {
    expect(validateBracket({ ...valid, picks: {} }).success).toBe(false);
    // Build > MAX_PICKS distinct keys across rounds to trip the size guard.
    const big: Record<string, string> = {};
    let n = 0;
    for (let r = 0; r <= 4 && n <= MAX_PICKS; r++) for (let t = 0; t <= 15 && n <= MAX_PICKS; t++) { big[`${r}-${t}`] = "BRA"; n++; }
    expect(Object.keys(big).length).toBeGreaterThan(MAX_PICKS);
    expect(validateBracket({ ...valid, picks: big }).success).toBe(false);
  });

  it("rejects a too-short / invalid username", () => {
    expect(validateBracket({ ...valid, username: "a" }).success).toBe(false);
    expect(validateBracket({ ...valid, username: "<script>" }).success).toBe(false);
  });
});
