import { describe, it, expect } from "vitest";
import { classifyPrediction, rankPredictions } from "@/lib/votes/predictions";
import type { VoteEntry } from "@/lib/votes/results";

const entry = (username: string, predHome: number, predAway: number): VoteEntry => ({
  matchId: "m",
  league: "fifa.world",
  username,
  predHome,
  predAway,
  createdAt: "2026-06-21T16:00:00Z",
});

describe("classifyPrediction", () => {
  const current = { home: 2, away: 1 };
  it("is winning on an exact match", () => {
    expect(classifyPrediction({ predHome: 2, predAway: 1 }, current)).toBe("winning");
  });
  it("can win when both predicted scores are still reachable", () => {
    expect(classifyPrediction({ predHome: 3, predAway: 1 }, current)).toBe("can");
    expect(classifyPrediction({ predHome: 2, predAway: 2 }, current)).toBe("can");
  });
  it("is losing once the score has passed the prediction on either side", () => {
    expect(classifyPrediction({ predHome: 1, predAway: 1 }, current)).toBe("losing");
    expect(classifyPrediction({ predHome: 2, predAway: 0 }, current)).toBe("losing");
  });
});

describe("rankPredictions", () => {
  it("orders winning -> can -> losing, stable within each group", () => {
    const entries = [
      entry("can1", 3, 1),
      entry("lose1", 0, 0),
      entry("win", 2, 1),
      entry("can2", 2, 2),
    ];
    const ranked = rankPredictions(entries, { home: 2, away: 1 });
    expect(ranked.map((r) => r.username)).toEqual(["win", "can1", "can2", "lose1"]);
    expect(ranked.map((r) => r.status)).toEqual(["winning", "can", "can", "losing"]);
  });
});
