import { describe, it, expect } from "vitest";
import type { VoteEntry } from "@/lib/votes";
import { selectVoteEntries, selectAllEntries, selectVoteCounts } from "@/lib/dev-fixture";

const e = (matchId: string, username: string, createdAt: string): VoteEntry => ({
  matchId,
  league: "fifa.world",
  username,
  predHome: 1,
  predAway: 0,
  createdAt,
});

const sample: VoteEntry[] = [
  e("1001", "a", "2026-06-29T10:00:00Z"),
  e("1002", "b", "2026-06-29T12:00:00Z"),
  e("1001", "c", "2026-06-29T11:00:00Z"),
  e("1002", "d", "2026-06-29T12:00:00Z"),
];

describe("dev-fixture selectors", () => {
  it("selectVoteEntries filters by match and orders newest-first", () => {
    expect(selectVoteEntries(sample, "1001").map((x) => x.username)).toEqual(["c", "a"]);
  });

  it("selectVoteEntries honours the limit", () => {
    expect(selectVoteEntries(sample, "1001", 1).map((x) => x.username)).toEqual(["c"]);
  });

  it("selectAllEntries orders newest-first with a deterministic match_id tiebreak", () => {
    // The two 12:00 rows tie on time → match_id asc ("1002" both) then input order;
    // newest overall first, oldest last.
    expect(selectAllEntries(sample).map((x) => x.username)).toEqual(["b", "d", "c", "a"]);
  });

  it("selectVoteCounts counts predictions per match", () => {
    expect(selectVoteCounts(sample)).toEqual({ "1001": 2, "1002": 2 });
  });
});
