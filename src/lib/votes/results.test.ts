import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapEntryRow, fetchVoteEntries, fetchAllEntries } from "@/lib/votes/results";

/** A thenable Supabase-query-builder stub that records every chained call and
 *  resolves to { data, error }. `cap` simulates PostgREST's server-side max-rows
 *  (a single response never exceeds it, even when `.limit()` asks for more) so we
 *  can prove `fetchAllEntries` pages past it via `.range()`. */
function mockClient(rows: unknown[], cap = Infinity) {
  const calls: Array<{ m: string; args: unknown[] }> = [];
  const builder: Record<string, unknown> = {};
  let range: [number, number] | null = null;
  for (const m of ["from", "select", "eq", "order", "limit", "range"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push({ m, args });
      if (m === "range") range = args as [number, number];
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => void) => {
    const data = range
      ? rows.slice(range[0], Math.min(range[1] + 1, range[0] + cap))
      : rows.slice(0, cap);
    range = null;
    resolve({ data, error: null });
  };
  const client = { from: (...a: unknown[]) => (builder.from as (...x: unknown[]) => unknown)(...a) };
  return { client: client as unknown as SupabaseClient, calls };
}

const row = (matchId: string, username: string) => ({
  match_id: matchId, league: "fifa.world", username, pred_home: 1, pred_away: 0, created_at: `t-${matchId}-${username}`,
});

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

  it("fetchAllEntries pages PAST the server row cap so old palpites aren't dropped", async () => {
    // 5 entries, but the server returns at most 2 rows per request. A single
    // capped request would drop the 3 oldest (the ranking bug); paging must not.
    const rows = [row("m5", "e"), row("m4", "d"), row("m3", "c"), row("m2", "b"), row("m1", "a")];
    const { client, calls } = mockClient(rows, 2);
    const out = await fetchAllEntries(client, 2); // pageSize 2 → 3 requests (2,2,1)
    expect(out.map((e) => e.matchId)).toEqual(["m5", "m4", "m3", "m2", "m1"]);
    expect(calls.filter((c) => c.m === "range").length).toBe(3);
  });

  it("fetchAllEntries de-dupes a palpite that straddles a page boundary", async () => {
    // A concurrent insert can shift a row so it appears at the end of one page and
    // the start of the next; (match_id, username) is unique per palpite → keep one.
    const rows = [row("a", "u"), row("b", "v"), row("b", "v"), row("c", "w")];
    const out = await fetchAllEntries(mockClient(rows, 2).client, 2);
    expect(out).toHaveLength(3);
    expect(out.filter((e) => e.matchId === "b" && e.username === "v")).toHaveLength(1);
  });

  it("fetchVoteEntries caps high enough for a popular match (bumped past 100)", async () => {
    const { client, calls } = mockClient([]);
    await fetchVoteEntries(client, "1001");
    const lim = calls.find((c) => c.m === "limit");
    expect(lim).toBeDefined();
    expect(lim!.args[0]).toBeGreaterThanOrEqual(500);
  });

  it("still maps the returned rows to typed VoteEntry", async () => {
    const { client } = mockClient([
      { match_id: "1001", league: "fifa.world", username: "u", pred_home: 2, pred_away: 1, created_at: "t" },
    ]);
    expect(await fetchVoteEntries(client, "1001")).toEqual([
      { matchId: "1001", league: "fifa.world", username: "u", predHome: 2, predAway: 1, penWinner: null, createdAt: "t" },
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
      penWinner: null,
      createdAt: "2026-06-21T16:00:00Z",
    });
  });
});
