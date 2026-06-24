import { describe, expect, it } from "vitest";
import { classifyLivePalpites } from "@/lib/live-palpites";
import type { VoteEntry } from "@/lib/votes";

function e(username: string, predHome: number, predAway: number): VoteEntry {
  return { matchId: "m", league: "fifa.world", username, predHome, predAway, createdAt: "2026-06-20T15:00:00Z" };
}

describe("classifyLivePalpites (live)", () => {
  // Mirrors the design's PLACAR example: current score 1–1.
  const current = { home: 1, away: 1 };
  const entries = [
    e("LilJam", 1, 1), // exact
    e("agomesp", 1, 2), // reachable, 1 away
    e("drakad", 4, 1), // reachable, 3 away
    e("Niko", 0, 0), // away already passed → lost
  ];

  it("features the exact hit, then promotes the closest reachable to fill the row", () => {
    const { winners } = classifyLivePalpites(entries, current);
    expect(winners.map((w) => [w.username, w.status])).toEqual([
      ["LilJam", "CRAVOU O PLACAR"],
      ["agomesp", "A 1 GOL"],
    ]);
  });

  it("puts the remaining reachable palpites in 'open' as PODE GANHAR", () => {
    const { open } = classifyLivePalpites(entries, current);
    expect(open.map((o) => o.username)).toEqual(["drakad"]);
    expect(open[0].status).toBe("PODE GANHAR");
  });

  it("marks passed predictions as lost / ERROU", () => {
    const { lost } = classifyLivePalpites(entries, current);
    expect(lost.map((l) => [l.username, l.status])).toEqual([["Niko", "ERROU"]]);
  });

  it("pluralizes the goals-away label", () => {
    // No exact hits → the two closest reachable are promoted with A N GOL(S).
    const { winners } = classifyLivePalpites(
      [e("a", 3, 1), e("b", 1, 3)],
      { home: 1, away: 1 },
    );
    expect(winners.map((w) => w.status)).toEqual(["A 2 GOLS", "A 2 GOLS"]);
  });
});

describe("classifyLivePalpites (finished)", () => {
  it("treats every non-exact palpite as lost when the match is final", () => {
    const { winners, open, lost } = classifyLivePalpites(
      [e("win", 2, 0), e("near", 3, 0), e("wrong", 0, 1)],
      { home: 2, away: 0 },
      true,
    );
    expect(winners.map((w) => w.username)).toEqual(["win"]);
    expect(open).toEqual([]);
    expect(lost.map((l) => l.username).sort()).toEqual(["near", "wrong"]);
  });
});
