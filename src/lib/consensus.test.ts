import { describe, expect, it } from "vitest";
import { communityConsensus } from "@/lib/consensus";

describe("communityConsensus", () => {
  it("buckets predictions into home / draw / away by outcome", () => {
    const c = communityConsensus([
      { predHome: 2, predAway: 1 }, // home
      { predHome: 1, predAway: 1 }, // draw
      { predHome: 0, predAway: 3 }, // away
      { predHome: 3, predAway: 0 }, // home
    ]);
    expect(c).toMatchObject({ home: 2, draw: 1, away: 1, total: 4 });
  });

  it("returns all-zero on no entries (no NaN)", () => {
    expect(communityConsensus([])).toEqual({
      home: 0,
      draw: 0,
      away: 0,
      total: 0,
      homePct: 0,
      drawPct: 0,
      awayPct: 0,
    });
  });

  it("rounds percentages so they always sum to 100", () => {
    // 1/3 each → 33/33/34 (largest remainder), summing to 100.
    const c = communityConsensus([
      { predHome: 1, predAway: 0 },
      { predHome: 0, predAway: 0 },
      { predHome: 0, predAway: 1 },
    ]);
    expect(c.homePct + c.drawPct + c.awayPct).toBe(100);
  });

  it("matches the design's 54 / 27 / 19 split shape", () => {
    const entries = [
      ...Array(54).fill({ predHome: 2, predAway: 0 }),
      ...Array(27).fill({ predHome: 1, predAway: 1 }),
      ...Array(19).fill({ predHome: 0, predAway: 2 }),
    ];
    const c = communityConsensus(entries);
    expect([c.homePct, c.drawPct, c.awayPct]).toEqual([54, 27, 19]);
  });
});
