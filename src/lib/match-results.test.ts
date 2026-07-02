import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapResultRow, fetchMatchResults } from "@/lib/match-results";

describe("mapResultRow", () => {
  it("maps a durable result row to a MatchResult (always post)", () => {
    expect(mapResultRow({ match_id: "760457", home_score: 3, away_score: 0, home_shootout: null, away_shootout: null }))
      .toEqual({ state: "post", homeScore: 3, awayScore: 0, homeShootout: null, awayShootout: null });
  });

  it("keeps the penalty-shootout tallies", () => {
    expect(mapResultRow({ match_id: "m", home_score: 1, away_score: 1, home_shootout: 3, away_shootout: 4 }))
      .toEqual({ state: "post", homeScore: 1, awayScore: 1, homeShootout: 3, awayShootout: 4 });
  });
});

describe("fetchMatchResults", () => {
  const client = (result: { data?: unknown; error?: unknown }) =>
    ({ from: () => ({ select: () => Promise.resolve(result) }) }) as unknown as SupabaseClient;

  it("keys the rows by match id", async () => {
    const out = await fetchMatchResults(
      client({ data: [{ match_id: "760457", home_score: 3, away_score: 0, home_shootout: null, away_shootout: null }] }),
    );
    expect(out["760457"]).toEqual({ state: "post", homeScore: 3, awayScore: 0, homeShootout: null, awayShootout: null });
  });

  it("returns {} on error so the ranking falls back to ESPN", async () => {
    expect(await fetchMatchResults(client({ error: { message: "relation does not exist" } }))).toEqual({});
  });
});
