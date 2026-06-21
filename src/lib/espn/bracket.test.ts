import { describe, it, expect } from "vitest";
import { buildBracket } from "@/lib/espn/bracket";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

describe("buildBracket", () => {
  it("produces 5 rounds with halving match counts", () => {
    const cols = buildBracket(LETTERS);
    expect(cols.map((c) => c.label)).toEqual([
      "32-avos",
      "Oitavas",
      "Quartas",
      "Semifinais",
      "Final",
    ]);
    expect(cols.map((c) => c.matches.length)).toEqual([16, 8, 4, 2, 1]);
  });

  it("seeds the Round of 32 from group placeholders", () => {
    const r32 = buildBracket(LETTERS)[0].matches;
    expect(r32[0]).toEqual({ a: "1A", b: "1B" });
    expect(r32.flatMap((m) => [m.a, m.b])).toContain("3·1");
  });
});
