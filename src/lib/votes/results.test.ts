import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapEntryRow, fetchVoteEntries, fetchAllEntries } from "@/lib/votes/results";

/** A thenable Supabase-query-builder stub that records every chained call and
 *  resolves to { data, error }. Lets us assert the query is built with an
 *  explicit .order() (B1) without a real client/network. */
function mockClient(rows: unknown[]) {
  const calls: Array<{ m: string; args: unknown[] }> = [];
  const builder: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "order", "limit"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push({ m, args });
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null });
  const client = { from: (...a: unknown[]) => (builder.from as (...x: unknown[]) => unknown)(...a) };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("vote fetchers order explicitly (audit B1)", () => {
  it("fetchVoteEntries orders newest-first (created_at desc)", async () => {
    const { client, calls } = mockClient([]);
    await fetchVoteEntries(client, "1001");
    const orders = calls.filter((c) => c.m === "order");
    expect(orders).toHaveLength(1);
    expect(orders[0].args).toEqual(["created_at", { ascending: false }]);
  });

  it("fetchAllEntries orders newest-first with a deterministic tiebreaker (stable truncation)", async () => {
    const { client, calls } = mockClient([]);
    await fetchAllEntries(client);
    const orders = calls.filter((c) => c.m === "order");
    expect(orders[0].args).toEqual(["created_at", { ascending: false }]);
    // a second order key makes the .limit() cut deterministic past the limit.
    expect(orders.length).toBeGreaterThanOrEqual(2);
    expect(orders[1].args[0]).toBe("match_id");
  });

  it("still maps the returned rows to typed VoteEntry", async () => {
    const { client } = mockClient([
      { match_id: "1001", league: "fifa.world", username: "u", pred_home: 2, pred_away: 1, created_at: "t" },
    ]);
    expect(await fetchVoteEntries(client, "1001")).toEqual([
      { matchId: "1001", league: "fifa.world", username: "u", predHome: 2, predAway: 1, createdAt: "t" },
    ]);
  });
});

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
