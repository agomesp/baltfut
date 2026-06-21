import { describe, it, expect } from "vitest";
import { mapResultRow, mapEntryRow } from "@/lib/votes/results";

describe("mapResultRow", () => {
  it("maps a snake_case aggregate row to a typed VoteResult", () => {
    const result = mapResultRow({
      match_id: "1002",
      league: "fifa.world",
      total_votes: 5,
      home_votes: 3,
      away_votes: 2,
      avg_pred_home: "1.80",
      avg_pred_away: "1.20",
      last_vote_at: "2026-06-21T16:00:00Z",
    });
    expect(result).toEqual({
      matchId: "1002",
      league: "fifa.world",
      totalVotes: 5,
      homeVotes: 3,
      awayVotes: 2,
      avgPredHome: 1.8,
      avgPredAway: 1.2,
    });
  });

  it("tolerates null averages (no votes yet)", () => {
    const result = mapResultRow({
      match_id: "x",
      league: "fifa.world",
      total_votes: 0,
      home_votes: 0,
      away_votes: 0,
      avg_pred_home: null,
      avg_pred_away: null,
      last_vote_at: null,
    });
    expect(result.avgPredHome).toBeNull();
    expect(result.avgPredAway).toBeNull();
  });
});

describe("mapEntryRow", () => {
  it("maps a snake_case entry row to a typed VoteEntry", () => {
    expect(
      mapEntryRow({
        match_id: "1002",
        league: "fifa.world",
        username: "Allan",
        preferred_side: "home",
        preferred_team_abbr: "FRA",
        pred_home: 2,
        pred_away: 1,
        created_at: "2026-06-21T16:00:00Z",
      }),
    ).toEqual({
      matchId: "1002",
      league: "fifa.world",
      username: "Allan",
      preferredSide: "home",
      preferredTeamAbbr: "FRA",
      predHome: 2,
      predAway: 1,
      createdAt: "2026-06-21T16:00:00Z",
    });
  });
});
