import { describe, it, expect } from "vitest";
import { craqueFor, squadFor, playerCutoutSrc } from "@/lib/player-images";

describe("squadFor", () => {
  it("returns the seeded squad list for a known team", () => {
    expect(squadFor("ENG").length).toBeGreaterThan(0);
  });

  it("returns [] for an unknown team (never throws)", () => {
    expect(squadFor("ZZZ")).toEqual([]);
    expect(squadFor("")).toEqual([]);
  });
});

describe("craqueFor", () => {
  it("returns the designated craque (first seeded entry) for a team", () => {
    const c = craqueFor("ENG");
    expect(c?.name).toMatch(/Bellingham/);
    expect(c?.img).toBe("eng/bellingham.png");
  });

  it("returns null for a team with no seeded craque", () => {
    expect(craqueFor("ZZZ")).toBeNull();
    expect(craqueFor("")).toBeNull();
  });
});

describe("playerCutoutSrc", () => {
  it("joins the basePath, players dir, and image path", () => {
    expect(playerCutoutSrc("eng/bellingham.png", "/baltfut")).toBe(
      "/baltfut/players/eng/bellingham.png",
    );
  });

  it("works with an empty basePath (local dev)", () => {
    expect(playerCutoutSrc("eng/bellingham.png", "")).toBe("/players/eng/bellingham.png");
  });
});
