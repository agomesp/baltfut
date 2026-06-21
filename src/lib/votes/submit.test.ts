import { describe, it, expect, vi } from "vitest";
import { submitVote, type CastVoteTransport } from "@/lib/votes/submit";

const validInput = {
  matchId: "1002",
  league: "fifa.world",
  username: "  Allan  ",
  preferredSide: "home" as const,
  preferredTeamAbbr: "FRA",
  predHome: 2,
  predAway: 1,
};

describe("submitVote", () => {
  it("rejects invalid input locally without calling the network", async () => {
    const transport = vi.fn<CastVoteTransport>();
    const outcome = await submitVote({ ...validInput, username: "<x>" }, transport);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.fields).toHaveProperty("username");
    expect(transport).not.toHaveBeenCalled();
  });

  it("sends the validated (trimmed) payload and resolves on 201", async () => {
    const transport = vi.fn<CastVoteTransport>(async () => ({ status: 201, body: { ok: true } }));
    const outcome = await submitVote(validInput, transport);
    expect(outcome.ok).toBe(true);
    expect(transport).toHaveBeenCalledOnce();
    expect(transport.mock.calls[0][0].username).toBe("Allan");
  });

  it("maps 409 to a friendly already-voted message", async () => {
    const transport = vi.fn<CastVoteTransport>(async () => ({ status: 409, body: {} }));
    const outcome = await submitVote(validInput, transport);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(409);
      expect(outcome.message).toMatch(/already voted/i);
    }
  });

  it("surfaces server field errors on 422", async () => {
    const transport = vi.fn<CastVoteTransport>(async () => ({
      status: 422,
      body: { error: "Validation failed", fields: { username: "bad" } },
    }));
    const outcome = await submitVote(validInput, transport);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.fields).toEqual({ username: "bad" });
  });

  it("returns a network-error message when the transport throws", async () => {
    const transport = vi.fn<CastVoteTransport>(async () => {
      throw new Error("offline");
    });
    const outcome = await submitVote(validInput, transport);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toMatch(/network/i);
  });
});
