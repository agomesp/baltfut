import { describe, it, expect } from "vitest";
import { decideClaim, CLAIM_STALE_MS } from "@shared/name-claim";

const iso = (ms: number) => new Date(ms).toISOString();

describe("decideClaim", () => {
  const now = Date.parse("2026-06-22T12:00:00Z");

  it("allows an unclaimed name", () => {
    expect(decideClaim(null, "mine", now)).toBe("ok");
  });

  it("allows the owner (same token)", () => {
    expect(decideClaim({ token_hash: "mine", last_used_at: iso(now - 1000) }, "mine", now)).toBe("ok");
  });

  it("rejects a name owned by someone else while fresh", () => {
    expect(decideClaim({ token_hash: "theirs", last_used_at: iso(now - 1000) }, "mine", now)).toBe("taken");
  });

  it("allows takeover once the claim is stale (>24h idle)", () => {
    expect(
      decideClaim({ token_hash: "theirs", last_used_at: iso(now - CLAIM_STALE_MS - 1000) }, "mine", now),
    ).toBe("ok");
  });

  it("still rejects another token just under the stale window", () => {
    expect(
      decideClaim({ token_hash: "theirs", last_used_at: iso(now - CLAIM_STALE_MS + 60_000) }, "mine", now),
    ).toBe("taken");
  });
});
