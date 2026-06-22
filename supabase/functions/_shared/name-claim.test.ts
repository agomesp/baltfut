import { describe, it, expect } from "vitest";
import { decideClaim, isReservedName, nameSkeleton, CLAIM_STALE_MS } from "@shared/name-claim";

const iso = (ms: number) => new Date(ms).toISOString();

describe("nameSkeleton", () => {
  it("folds the capital-I / lowercase-l homoglyph (the demonstrated attack)", () => {
    expect(nameSkeleton("Rodrigo BaItar")).toBe(nameSkeleton("Rodrigo Baltar"));
    expect(nameSkeleton("Rodrigo Baltar")).toBe("rodrigobaltar");
  });

  it("is case-insensitive and ignores spaces/separators", () => {
    expect(nameSkeleton("aLLaN")).toBe("allan");
    const k = nameSkeleton("Rodrigo Baltar");
    expect(nameSkeleton("Rodrigo  Baltar")).toBe(k);
    expect(nameSkeleton("Rodrigo.Baltar")).toBe(k);
    expect(nameSkeleton("Rodrigo_Baltar")).toBe(k);
    expect(nameSkeleton("Rodrigo-Baltar")).toBe(k);
  });

  it("folds digit look-alikes (1->l, 0->o)", () => {
    expect(nameSkeleton("Ba1tar")).toBe(nameSkeleton("Baltar"));
    expect(nameSkeleton("R0drigo")).toBe(nameSkeleton("Rodrigo"));
  });

  it("strips diacritics", () => {
    expect(nameSkeleton("Téo")).toBe(nameSkeleton("Teo"));
    expect(nameSkeleton("Álvarez")).toBe("alvarez");
  });

  it("folds common cross-script (Cyrillic) look-alikes", () => {
    expect(nameSkeleton("Rоdrigo")).toBe(nameSkeleton("Rodrigo")); // Cyrillic 'о'
    expect(nameSkeleton("аllаn")).toBe("allan"); // Cyrillic 'а'
  });

  it("strips zero-width / invisible characters", () => {
    expect(nameSkeleton("Bal​tar")).toBe(nameSkeleton("Baltar"));
  });

  it("does NOT fold a genuinely-different dotted lowercase 'i'", () => {
    expect(nameSkeleton("baitar")).not.toBe(nameSkeleton("baltar"));
  });
});

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

describe("isReservedName", () => {
  it("reserves ChatGPT in any casing", () => {
    expect(isReservedName("ChatGPT")).toBe(true);
    expect(isReservedName("chatgpt")).toBe(true);
    expect(isReservedName("CHATGPT")).toBe(true);
  });

  it("reserves it past spacing/separators used to impersonate", () => {
    expect(isReservedName("  chatgpt  ")).toBe(true);
    expect(isReservedName("Chat GPT")).toBe(true);
    expect(isReservedName("Chat-GPT")).toBe(true);
    expect(isReservedName("chat.gpt")).toBe(true);
    expect(isReservedName("chat_gpt")).toBe(true);
  });

  it("does not reserve ordinary names", () => {
    expect(isReservedName("Allan")).toBe(false);
    expect(isReservedName("chatgptfan")).toBe(false);
    expect(isReservedName("GPT")).toBe(false);
    expect(isReservedName("")).toBe(false);
  });
});
