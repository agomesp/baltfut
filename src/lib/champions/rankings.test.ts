import { describe, it, expect } from "vitest";
import type { VoteEntry } from "@/lib/votes";
import type { MatchResult, SubRank } from "@/lib/ranking";
import {
  bestAccuracyRanking,
  championsBoard,
  halfPointRanking,
  mostPalpitesRanking,
  worstAccuracyRanking,
} from "@/lib/champions/rankings";

const post = (h: number, a: number): MatchResult => ({
  state: "post",
  homeScore: h,
  awayScore: a,
  homeShootout: null,
  awayShootout: null,
});

const e = (username: string, matchId: string, predHome: number, predAway: number): VoteEntry => ({
  matchId,
  league: "fifa.world",
  username,
  predHome,
  predAway,
  createdAt: "2026-06-20T17:00:00Z",
});

describe("halfPointRanking", () => {
  // Half a point per side called exactly, so an exact scoreline is worth a full point.
  const byId: Record<string, MatchResult> = { m1: post(0, 1), m2: post(2, 2) };

  it("gives 0.5 for one side right and 1 for the exact score", () => {
    const rows = halfPointRanking(
      [
        e("ana", "m1", 2, 1), // away right → 0.5
        e("bob", "m1", 0, 1), // both right → 1
        e("cid", "m1", 3, 3), // neither → 0
      ],
      byId,
    );
    expect(rows).toEqual([
      { username: "bob", points: 1, exact: 1, halves: 0, matches: 1 },
      { username: "ana", points: 0.5, exact: 0, halves: 1, matches: 1 },
      { username: "cid", points: 0, exact: 0, halves: 0, matches: 1 },
    ]);
  });

  it("sums across matches", () => {
    const rows = halfPointRanking([e("ana", "m1", 0, 5), e("ana", "m2", 9, 2)], byId);
    expect(rows[0]).toEqual({ username: "ana", points: 1, exact: 0, halves: 2, matches: 2 });
  });

  it("counts a repeated score once per side (2×2 vs 2×2 is exact, not double)", () => {
    const rows = halfPointRanking([e("ana", "m2", 2, 2)], byId);
    expect(rows[0].points).toBe(1);
    expect(rows[0].exact).toBe(1);
  });

  it("ignores unfinished matches and drops the house bot", () => {
    const open: Record<string, MatchResult> = { m3: { ...post(1, 1), state: "in" } };
    expect(halfPointRanking([e("ana", "m3", 1, 1)], open)).toEqual([]);
    expect(halfPointRanking([e("ChatGPT", "m1", 0, 1)], byId)).toEqual([]);
  });
});

describe("mostPalpitesRanking", () => {
  it("ranks by graded palpite count, bot excluded", () => {
    const byId: Record<string, MatchResult> = { m1: post(1, 0), m2: post(2, 0), m3: post(3, 0) };
    const rows = mostPalpitesRanking(
      [
        e("ana", "m1", 0, 0),
        e("ana", "m2", 0, 0),
        e("ana", "m3", 0, 0),
        e("bob", "m1", 0, 0),
        e("ChatGPT", "m1", 0, 0),
        e("ChatGPT", "m2", 0, 0),
        e("ChatGPT", "m3", 0, 0),
      ],
      byId,
      5,
    );
    expect(rows).toEqual([
      { username: "ana", palpites: 3 },
      { username: "bob", palpites: 1 },
    ]);
  });
});

describe("worstAccuracyRanking", () => {
  // The owner's case: 9 wrong out of 10 must rank worse than 9 wrong out of 20,
  // because the rate — not the raw error count — is what's compared.
  const byId: Record<string, MatchResult> = Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [`m${i}`, post(1, 0)]),
  );
  const picks = (username: string, total: number, hits: number) =>
    Array.from({ length: total }, (_, i) => e(username, `m${i}`, i < hits ? 1 : 9, i < hits ? 0 : 9));

  it("ranks by hit rate ascending, so 1/10 is worse than 11/20", () => {
    const rows = worstAccuracyRanking([...picks("ana", 10, 1), ...picks("bob", 20, 11)], byId, 10, 5);
    expect(rows.map((r) => r.username)).toEqual(["ana", "bob"]);
    expect(rows[0]).toEqual({ username: "ana", hits: 1, palpites: 10, pct: 0.1 });
    expect(rows[1].pct).toBeCloseTo(0.55);
  });

  it("gates out small samples so a single wrong palpite can't top it", () => {
    const rows = worstAccuracyRanking([...picks("tiny", 2, 0), ...picks("ana", 10, 1)], byId, 10, 5);
    expect(rows.map((r) => r.username)).toEqual(["ana"]);
  });

  it("breaks ties on volume — more palpites at the same rate ranks worse", () => {
    const rows = worstAccuracyRanking([...picks("few", 10, 1), ...picks("many", 20, 2)], byId, 10, 5);
    expect(rows.map((r) => r.username)).toEqual(["many", "few"]);
  });
});

describe("bestAccuracyRanking", () => {
  const byId: Record<string, MatchResult> = Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => [`m${i}`, post(1, 0)]),
  );
  const picks = (username: string, total: number, hits: number) =>
    Array.from({ length: total }, (_, i) => e(username, `m${i}`, i < hits ? 1 : 9, i < hits ? 0 : 9));

  it("ranks by hit rate descending, so 5/10 beats 6/30", () => {
    const rows = bestAccuracyRanking([...picks("ana", 10, 5), ...picks("bob", 30, 6)], byId, 6, 5);
    expect(rows.map((r) => r.username)).toEqual(["ana", "bob"]);
    expect(rows[0]).toEqual({ username: "ana", hits: 5, palpites: 10, pct: 0.5 });
    expect(rows[1].pct).toBeCloseTo(0.2);
  });

  it("gates out small samples so 1-of-1 at 100% can't top it", () => {
    const rows = bestAccuracyRanking([...picks("lucky", 1, 1), ...picks("ana", 10, 5)], byId, 6, 5);
    expect(rows.map((r) => r.username)).toEqual(["ana"]);
  });

  it("admits a sub on exactly the minimum, but not one below it", () => {
    const rows = bestAccuracyRanking([...picks("six", 6, 3), ...picks("five", 5, 3)], byId, 6, 5);
    expect(rows.map((r) => r.username)).toEqual(["six"]);
  });

  it("breaks ties on volume — sustaining the same rate for longer ranks better", () => {
    const rows = bestAccuracyRanking([...picks("few", 10, 5), ...picks("many", 20, 10)], byId, 6, 5);
    expect(rows.map((r) => r.username)).toEqual(["many", "few"]);
  });

  it("drops the house bot and caps the board", () => {
    const rows = bestAccuracyRanking(
      [...picks("ChatGPT", 30, 30), ...picks("ana", 10, 5), ...picks("bob", 10, 4)],
      byId,
      6,
      1,
    );
    expect(rows.map((r) => r.username)).toEqual(["ana"]);
  });
});

describe("championsBoard", () => {
  const rank = (username: string, wins: number): SubRank => ({
    username,
    wins,
    losses: 0,
    penWins: 0,
    penLosses: 0,
  });

  it("pulls the house bot out as a benchmark so a human takes the top spot", () => {
    const board = championsBoard([rank("ChatGPT", 15), rank("ana", 9), rank("bob", 7)], 10);
    expect(board.bot).toEqual(rank("ChatGPT", 15));
    expect(board.top.map((r) => r.username)).toEqual(["ana", "bob"]);
    expect(board.champion?.username).toBe("ana");
  });

  it("caps the board and copes with no bot present", () => {
    const board = championsBoard(
      Array.from({ length: 14 }, (_, i) => rank(`u${i}`, 14 - i)),
      10,
    );
    expect(board.bot).toBeNull();
    expect(board.top).toHaveLength(10);
    expect(board.champion?.username).toBe("u0");
  });

  it("has no champion when nobody has scored", () => {
    expect(championsBoard([], 10).champion).toBeNull();
  });
});
