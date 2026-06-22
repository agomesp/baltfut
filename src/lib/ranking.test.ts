import { describe, it, expect } from "vitest";
import { rankSubs } from "@/lib/ranking";
import type { Match } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";

function match(id: string, state: Match["state"], hs: number | null, as: number | null, startsAt = "2026-06-20T16:00:00Z"): Match {
  return {
    id, league: "fifa.world", name: id, shortName: id, startsAt, state,
    isLive: state === "in", statusDetail: "", displayClock: null, venue: null,
    home: { id: "h", name: "H", abbreviation: "H", logo: null },
    away: { id: "a", name: "A", abbreviation: "A", logo: null },
    homeScore: hs, awayScore: as, goals: [], cards: [],
  };
}
function entry(username: string, matchId: string, predHome: number, predAway: number, createdAt = "2026-06-20T15:00:00Z"): VoteEntry {
  return { matchId, league: "fifa.world", username, predHome, predAway, createdAt };
}

const matchesById: Record<string, Match> = {
  m1: match("m1", "post", 2, 1),
  m2: match("m2", "post", 0, 0),
  mLive: match("mLive", "in", 1, 0),
};

describe("rankSubs", () => {
  it("tallies wins (exact) and losses against finished matches, sorted by wins", () => {
    const ranked = rankSubs(
      [
        entry("ana", "m1", 2, 1), // win
        entry("ana", "m2", 0, 0), // win
        entry("bob", "m1", 1, 1), // loss
        entry("bob", "m2", 0, 0), // win
      ],
      matchesById,
    );
    expect(ranked).toEqual([
      { username: "ana", wins: 2, losses: 0 },
      { username: "bob", wins: 1, losses: 1 },
    ]);
  });

  it("ignores palpites on unfinished matches", () => {
    expect(rankSubs([entry("ana", "mLive", 1, 0)], matchesById)).toEqual([]);
  });

  it("counts every palpite on a finished match, regardless of when placed", () => {
    // Placed mid-match (the form lock prevents this going forward, but historical
    // live palpites should still count toward wins/losses).
    const late = entry("Markler", "m1", 2, 1, "2026-06-20T16:30:00Z");
    expect(rankSubs([late], matchesById)).toEqual([
      { username: "Markler", wins: 1, losses: 0 },
    ]);
  });
});
