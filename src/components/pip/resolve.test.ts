import { describe, it, expect } from "vitest";
import type { Match } from "@/lib/espn";
import { clockOrder, esc, pickMatch, resolveLayout } from "@/components/pip/resolve";

// Inner content sizes are ~30–55px shorter than the LAYOUT_SIZE outer values
// because of the PiP title bar; these assert the resolver against those inner
// boxes so each size button lands on its intended layout.
describe("resolveLayout", () => {
  it("maps each size button's inner box to its own layout", () => {
    expect(resolveLayout(544, 70, false)).toBe("bar"); // bar 560x110
    expect(resolveLayout(184, 160, false)).toBe("square"); // square 200x200
    expect(resolveLayout(344, 400, false)).toBe("full"); // full 360x440
    expect(resolveLayout(604, 140, false)).toBe("wide"); // wide 620x180
  });

  it("keeps Largo as wide even with a heavy title bar (not Barra)", () => {
    expect(resolveLayout(604, 125, false)).toBe("wide");
  });

  it("applies hysteresis on the bar boundary", () => {
    // Coming from a non-bar layout, only become bar below 100px...
    expect(resolveLayout(600, 108, false)).not.toBe("bar");
    // ...but once in bar, stay bar until above 115px.
    expect(resolveLayout(600, 108, true)).toBe("bar");
  });
});

describe("clockOrder", () => {
  it("orders stoppage time just after the minute", () => {
    expect(clockOrder("45'")).toBeLessThan(clockOrder("45'+2'"));
    expect(clockOrder("45'+2'")).toBeLessThan(clockOrder("46'"));
  });
});

function m(id: string, state: Match["state"], startsAt: string): Match {
  return {
    id, league: "fifa.world", name: id, shortName: id, startsAt, state,
    isLive: state === "in", statusDetail: "", displayClock: null, venue: null,
    home: { id: "h", name: "H", abbreviation: "H", logo: null },
    away: { id: "a", name: "A", abbreviation: "A", logo: null },
    homeScore: null, awayScore: null, goals: [], cards: [],
  };
}

describe("pickMatch", () => {
  const now = Date.parse("2026-06-22T18:00:00Z");

  it("prefers a live match", () => {
    const matches = [m("pre", "pre", "2026-06-22T20:00:00Z"), m("live", "in", "2026-06-22T17:00:00Z")];
    expect(pickMatch(matches, now)?.id).toBe("live");
  });

  it("falls back to the soonest upcoming when none live", () => {
    const matches = [m("later", "pre", "2026-06-22T22:00:00Z"), m("soon", "pre", "2026-06-22T19:00:00Z")];
    expect(pickMatch(matches, now)?.id).toBe("soon");
  });

  it("falls back to the most recent finished when none live/upcoming", () => {
    const matches = [m("old", "post", "2026-06-21T18:00:00Z"), m("recent", "post", "2026-06-22T14:00:00Z")];
    expect(pickMatch(matches, now)?.id).toBe("recent");
  });

  it("returns null for an empty list", () => {
    expect(pickMatch([], now)).toBeNull();
  });
});

describe("esc", () => {
  it("escapes HTML-significant characters", () => {
    expect(esc('<b>"x"&y')).toBe("&lt;b&gt;&quot;x&quot;&amp;y");
  });
});
