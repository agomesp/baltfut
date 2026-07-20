import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseScoreboard } from "@/lib/espn/parse";
import { fetchArchivedMatches, fetchArchivedStandings, fetchArchivedLineups } from "@/lib/espn/archive";

/**
 * The archive's one guarantee: a match read back from Postgres is byte-identical
 * to the same match read live from ESPN, because BOTH go through the app's
 * parser. If these ever diverge, the archive has silently started lying.
 */

const espnEvent = {
  id: "727354",
  date: "2026-07-19T19:00Z",
  season: { slug: "final" },
  status: { type: { state: "post", detail: "FT", completed: true } },
  competitions: [
    {
      venue: { address: { city: "East Rutherford" } },
      competitors: [
        { homeAway: "home", score: "2", team: { id: "164", displayName: "Spain", abbreviation: "ESP", logo: "esp.png" } },
        { homeAway: "away", score: "1", team: { id: "202", displayName: "Argentina", abbreviation: "ARG", logo: "arg.png" } },
      ],
      details: [],
    },
  ],
};

/** Minimal stub of the two PostgREST shapes the reader uses. */
function stubClient(table: Record<string, { data: unknown; error?: unknown }>): SupabaseClient {
  return {
    from: (name: string) => {
      const res = table[name] ?? { data: [] };
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: () => Promise.resolve(res),
        then: (r: (v: unknown) => unknown) => Promise.resolve(res).then(r),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe("fetchArchivedMatches", () => {
  it("rehydrates a stored match identically to parsing it live", async () => {
    const live = parseScoreboard({ events: [espnEvent] }, "fifa.world");
    const client = stubClient({ espn_matches: { data: [{ raw: espnEvent }] } });

    const archived = await fetchArchivedMatches(client, "fifa.world");

    expect(archived).toEqual(live);
    expect(archived[0].home.abbreviation).toBe("ESP");
    expect(archived[0].stage).toBe("final");
    expect(archived[0].venue).toBe("East Rutherford");
  });

  it("returns [] when the table is missing rather than throwing", async () => {
    const client = stubClient({ espn_matches: { data: null, error: { message: "no such table" } } });
    await expect(fetchArchivedMatches(client, "fifa.world")).resolves.toEqual([]);
  });
});

describe("fetchArchivedStandings", () => {
  it("parses the stored standings blob through the live parser", async () => {
    const raw = {
      children: [
        {
          name: "Group A",
          abbreviation: "A",
          standings: {
            entries: [
              {
                team: { abbreviation: "MEX", displayName: "Mexico" },
                stats: [
                  { name: "gamesPlayed", value: 3 },
                  { name: "pointDifferential", displayValue: "+3" },
                  { name: "points", value: 7 },
                  { name: "rank", value: 1 },
                ],
              },
            ],
          },
        },
      ],
    };
    const client = stubClient({ espn_standings: { data: { raw } } });
    const groups = await fetchArchivedStandings(client, "fifa.world");
    expect(groups[0]?.letter).toBe("A");
    expect(groups[0]?.rows[0]?.code).toBe("MEX");
  });

  it("returns [] when nothing is archived for that league", async () => {
    const client = stubClient({ espn_standings: { data: null } });
    await expect(fetchArchivedStandings(client, "bra.1")).resolves.toEqual([]);
  });
});

describe("fetchArchivedLineups", () => {
  it("returns null when the match has no archived summary", async () => {
    const client = stubClient({ espn_summaries: { data: null } });
    await expect(fetchArchivedLineups(client, "nope")).resolves.toBeNull();
  });

  it("parses the stored roster slice", async () => {
    const raw = {
      rosters: [
        { homeAway: "home", team: { abbreviation: "ESP" }, formation: "4-3-3", roster: [{ starter: true, jersey: "1", position: { abbreviation: "G" }, athlete: { displayName: "Simón" } }] },
        { homeAway: "away", team: { abbreviation: "ARG" }, formation: "4-4-2", roster: [{ starter: true, jersey: "23", position: { abbreviation: "G" }, athlete: { displayName: "Martínez" } }] },
      ],
    };
    const client = stubClient({ espn_summaries: { data: { raw } } });
    const lineups = await fetchArchivedLineups(client, "727354");
    expect(lineups?.home.code).toBe("ESP");
    expect(lineups?.away.formation).toBe("4-4-2");
  });
});

describe("resilience", () => {
  it("never throws at the caller — a broken client degrades to empty", async () => {
    const boom = { from: vi.fn(() => { throw new Error("network down"); }) } as unknown as SupabaseClient;
    await expect(fetchArchivedMatches(boom, "fifa.world")).resolves.toEqual([]);
    await expect(fetchArchivedStandings(boom, "fifa.world")).resolves.toEqual([]);
    await expect(fetchArchivedLineups(boom, "1")).resolves.toBeNull();
  });
});
