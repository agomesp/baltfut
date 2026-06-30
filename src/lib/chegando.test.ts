import { describe, it, expect } from "vitest";
import { chegandoValue, detectChegandoChanges, buildChegandoRows } from "@/lib/chegando";
import type { VoteEntry } from "@/lib/votes";

const e = (username: string, predHome: number, predAway: number, createdAt: string, penWinner: "home" | "away" | null = null): VoteEntry => ({
  matchId: "m", league: "fifa.world", username, predHome, predAway, penWinner, createdAt,
});

describe("detectChegandoChanges", () => {
  it("does NOT flag the first sight of a name", () => {
    const seen = new Map<string, string>();
    expect(detectChegandoChanges([e("ana", 2, 1, "t1")], seen, false, "BRA", "JPN")).toEqual([]);
    expect(seen.get("ana")).toBe("2×1");
  });

  it("flags a name whose score CHANGED, not one that stayed the same", () => {
    const seen = new Map<string, string>();
    detectChegandoChanges([e("ana", 2, 1, "t1"), e("bia", 0, 0, "t1")], seen, false, "BRA", "JPN");
    const changed = detectChegandoChanges(
      [e("ana", 3, 1, "t1"), e("bia", 0, 0, "t1")], // ana re-palpited, bia unchanged
      seen, false, "BRA", "JPN",
    );
    expect(changed).toEqual(["ana"]);
    expect(seen.get("ana")).toBe("3×1");
  });

  it("tracks pen-winner changes in pen mode", () => {
    const seen = new Map<string, string>();
    detectChegandoChanges([e("ana", 1, 1, "t1", "home")], seen, true, "BRA", "JPN");
    expect(detectChegandoChanges([e("ana", 1, 1, "t1", "away")], seen, true, "BRA", "JPN")).toEqual(["ana"]);
  });
});

describe("buildChegandoRows", () => {
  it("puts the most-recent event first; a CHANGED row bubbles above newer creations", () => {
    const entries = [
      e("ana", 2, 1, "2026-06-30T20:00:00Z"),
      e("bia", 1, 0, "2026-06-30T20:05:00Z"), // newest creation
    ];
    // ana changed just now (later than bia's creation) → ana on top, marked changed.
    const changedAt = new Map([["ana", Date.parse("2026-06-30T20:10:00Z")]]);
    const rows = buildChegandoRows(entries, changedAt, false, "BRA", "JPN");
    expect(rows.map((r) => r.nick)).toEqual(["ana", "bia"]);
    expect(rows[0]).toMatchObject({ nick: "ana", value: "2×1", changed: true });
    expect(rows[1]).toMatchObject({ nick: "bia", changed: false });
  });

  it("with no changes, orders by creation time (newest first) and marks nothing changed", () => {
    const entries = [
      e("ana", 2, 1, "2026-06-30T20:00:00Z"),
      e("bia", 1, 0, "2026-06-30T20:05:00Z"),
    ];
    const rows = buildChegandoRows(entries, new Map(), false, "BRA", "JPN");
    expect(rows.map((r) => r.nick)).toEqual(["bia", "ana"]);
    expect(rows.every((r) => !r.changed)).toBe(true);
  });

  it("keeps one row per user (no duplicate to delete) and caps the list", () => {
    const entries = Array.from({ length: 30 }, (_, i) => e(`u${i}`, 1, 0, `2026-06-30T20:00:${String(i).padStart(2, "0")}Z`));
    const rows = buildChegandoRows(entries, new Map(), false, "BRA", "JPN", 24);
    expect(rows).toHaveLength(24);
    expect(new Set(rows.map((r) => r.key)).size).toBe(24);
  });

  it("chegandoValue: score vs pen team code", () => {
    expect(chegandoValue(e("ana", 3, 2, "t"), false, "BRA", "JPN")).toBe("3×2");
    expect(chegandoValue(e("ana", 0, 0, "t", "away"), true, "BRA", "JPN")).toBe("JPN");
  });
});
