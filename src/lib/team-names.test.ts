import { describe, it, expect } from "vitest";
import { teamNamePt, flagEmoji } from "@/lib/team-names";

const ri = (a: number, b: number) =>
  String.fromCodePoint(0x1f1e6 + a, 0x1f1e6 + b);

describe("teamNamePt", () => {
  it("localizes known FIFA codes and falls back otherwise", () => {
    expect(teamNamePt("BRA", "Brazil")).toBe("Brasil");
    expect(teamNamePt("ZZZ", "Zedland")).toBe("Zedland");
  });
});

describe("flagEmoji", () => {
  it("builds a regional-indicator flag from the FIFA->ISO2 mapping", () => {
    expect(flagEmoji("BRA")).toBe(ri(1, 17)); // BR
    expect(flagEmoji("ESP")).toBe(ri(4, 18)); // ES
    expect(flagEmoji("JPN")).toBe(ri(9, 15)); // JP
  });

  it("uses subdivision tag flags for the home nations", () => {
    // Black-flag base U+1F3F4 + tag sequence.
    expect(flagEmoji("ENG").codePointAt(0)).toBe(0x1f3f4);
    expect(flagEmoji("SCO").codePointAt(0)).toBe(0x1f3f4);
    expect(flagEmoji("WAL").codePointAt(0)).toBe(0x1f3f4);
  });

  it("returns empty string for unknown codes", () => {
    expect(flagEmoji("ZZZ")).toBe("");
    expect(flagEmoji("")).toBe("");
  });
});
