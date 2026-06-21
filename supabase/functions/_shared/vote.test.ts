import { describe, it, expect } from "vitest";
import { validateVote, voteInputSchema, USERNAME_MAX, SCORE_MAX } from "@shared/vote";

const valid = {
  matchId: "1002",
  league: "fifa.world",
  username: "  Allan  ",
  predHome: 2,
  predAway: 1,
};

describe("validateVote", () => {
  it("accepts a well-formed prediction and trims the name", () => {
    const result = validateVote(valid);
    expect(result.success).toBe(true);
    expect(result.data?.username).toBe("Allan");
    expect(result.errors).toBeUndefined();
  });

  it("allows a draw prediction (e.g. 1-1)", () => {
    expect(validateVote({ ...valid, predHome: 1, predAway: 1 }).success).toBe(true);
  });

  it("rejects a whitespace-only username", () => {
    const result = validateVote({ ...valid, username: "   " });
    expect(result.success).toBe(false);
    expect(result.errors).toHaveProperty("username");
  });

  it("rejects a username over the max length", () => {
    const result = validateVote({ ...valid, username: "a".repeat(USERNAME_MAX + 1) });
    expect(result.success).toBe(false);
    expect(result.errors).toHaveProperty("username");
  });

  it("rejects usernames with unsafe characters", () => {
    const result = validateVote({ ...valid, username: "<script>" });
    expect(result.success).toBe(false);
    expect(result.errors).toHaveProperty("username");
  });

  it("rejects non-integer, negative, or out-of-range scores", () => {
    expect(validateVote({ ...valid, predHome: 1.5 }).success).toBe(false);
    expect(validateVote({ ...valid, predAway: -1 }).success).toBe(false);
    expect(validateVote({ ...valid, predHome: SCORE_MAX + 1 }).success).toBe(false);
  });

  it("rejects a malformed league slug", () => {
    const result = validateVote({ ...valid, league: "../etc/passwd" });
    expect(result.success).toBe(false);
    expect(result.errors).toHaveProperty("league");
  });

  it("rejects missing fields and unknown payloads", () => {
    expect(validateVote({}).success).toBe(false);
    expect(validateVote(null).success).toBe(false);
    expect(validateVote("nope").success).toBe(false);
  });

  it("strips unknown keys rather than trusting them", () => {
    const result = validateVote({ ...valid, isAdmin: true, ipHash: "spoofed" });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("isAdmin");
    expect(result.data).not.toHaveProperty("ipHash");
  });

  it("exposes the schema for server-side reuse", () => {
    expect(voteInputSchema.safeParse(valid).success).toBe(true);
  });
});
