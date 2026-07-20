import { describe, it, expect } from "vitest";
// Shared .mjs core — imported by the Node snapshot script too, so the transform
// the archive writes with is the one covered here.
import { buildMatchRows, summariesToFetch, finishedCount, pickSummary } from "@/lib/espn/archive-core.mjs";

const event = (id: string, state: string, date = "2026-07-19T19:00Z", extra: object = {}) => ({
  id,
  date,
  status: { type: { state } },
  competitions: [{ competitors: [{ homeAway: "home" }, { homeAway: "away" }] }],
  ...extra,
});

describe("buildMatchRows", () => {
  it("keeps the ESPN event untouched in `raw`", () => {
    // The whole point of the archive: nothing ESPN sent is dropped, including
    // fields the app's parser ignores today.
    const e = event("727354", "post", "2026-07-19T19:00Z", { weirdFutureField: { a: 1 } });
    const [row] = buildMatchRows({ events: [e] }, "fifa.world");
    expect(row.raw).toEqual(e);
    expect(row.raw.weirdFutureField).toEqual({ a: 1 });
  });

  it("lifts out only the shallow index fields", () => {
    const [row] = buildMatchRows({ events: [event("1", "post")] }, "fifa.world");
    expect(row).toMatchObject({
      match_id: "1",
      league: "fifa.world",
      starts_at: "2026-07-19T19:00Z",
      state: "post",
    });
  });

  it("survives events missing status or date rather than guessing", () => {
    const rows = buildMatchRows({ events: [{ id: "9" }] }, "fifa.world");
    expect(rows[0]).toMatchObject({ match_id: "9", starts_at: null, state: null });
  });

  it("skips entries with no id — they can't be keyed", () => {
    expect(buildMatchRows({ events: [{ date: "x" }, event("2", "pre")] }, "fifa.world")).toHaveLength(1);
  });

  it("tolerates an empty or malformed payload", () => {
    expect(buildMatchRows({}, "fifa.world")).toEqual([]);
    expect(buildMatchRows(null, "fifa.world")).toEqual([]);
  });
});

describe("summariesToFetch", () => {
  const rows = [
    { match_id: "done", state: "post" },
    { match_id: "live", state: "in" },
    { match_id: "later", state: "pre" },
  ];

  it("skips a finished match already archived — its summary can't change again", () => {
    expect(summariesToFetch(rows, new Set(["done"]))).toEqual(["live"]);
  });

  it("fetches a finished match we don't have yet", () => {
    expect(summariesToFetch(rows, new Set())).toEqual(["done", "live"]);
  });

  it("keeps refetching a live match — its lineup is still filling in", () => {
    expect(summariesToFetch(rows, new Set(["done", "live"]))).toEqual(["live"]);
  });

  it("never fetches a match that hasn't kicked off", () => {
    expect(summariesToFetch(rows, new Set()).includes("later")).toBe(false);
  });

  it("accepts a plain array of stored ids as well as a Set", () => {
    expect(summariesToFetch(rows, ["done"])).toEqual(["live"]);
  });
});

describe("finishedCount", () => {
  it("counts only finished matches", () => {
    expect(finishedCount([{ state: "post" }, { state: "in" }, { state: "post" }])).toBe(2);
  });
});

describe("pickSummary", () => {
  it("keeps exactly the keys parseLineups reads", () => {
    const slice = pickSummary({
      rosters: [{ homeAway: "home" }],
      keyEvents: [{ type: { type: "substitution" } }],
      commentary: ["huge"], news: ["huge"], videos: ["huge"], boxscore: { huge: true },
    });
    expect(slice).not.toBeNull();
    expect(Object.keys(slice as object).sort()).toEqual(["keyEvents", "rosters"]);
  });

  it("drops the ~175KB per match of commentary/news/video we never touch", () => {
    const slice = pickSummary({ rosters: [1], commentary: "x".repeat(60_000) });
    expect(JSON.stringify(slice).length).toBeLessThan(50);
  });

  it("returns null when there is nothing we use, rather than an empty husk", () => {
    // An empty object would later read as "this match's lineup is archived".
    expect(pickSummary({ commentary: [], news: [] })).toBeNull();
    expect(pickSummary(null)).toBeNull();
    expect(pickSummary("nope")).toBeNull();
  });

  it("keeps rosters even when keyEvents is absent (a match with no subs)", () => {
    expect(pickSummary({ rosters: [1] })).toEqual({ rosters: [1] });
  });
});
