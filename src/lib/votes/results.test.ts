import { describe, it, expect } from "vitest";
import { mapEntryRow } from "@/lib/votes/results";

describe("mapEntryRow", () => {
  it("maps a snake_case prediction row to a typed VoteEntry", () => {
    expect(
      mapEntryRow({
        match_id: "1002",
        league: "fifa.world",
        username: "Allan",
        pred_home: 2,
        pred_away: 1,
        created_at: "2026-06-21T16:00:00Z",
      }),
    ).toEqual({
      matchId: "1002",
      league: "fifa.world",
      username: "Allan",
      predHome: 2,
      predAway: 1,
      createdAt: "2026-06-21T16:00:00Z",
    });
  });
});
