import { describe, expect, it } from "vitest";
import type { Match } from "@/lib/espn";
import { buildTimeline, eventMinute } from "@/components/live/bf-ui";

const base: Match = {
  id: "1",
  league: "fifa.world",
  name: "Bosnia vs Qatar",
  shortName: "BIH v QAT",
  startsAt: "2026-06-24T19:00:00Z",
  state: "in",
  isLive: true,
  statusDetail: "2nd Half",
  displayClock: "70'",
  venue: null,
  home: { id: "h", name: "Bosnia", abbreviation: "BIH", logo: null },
  away: { id: "a", name: "Qatar", abbreviation: "QAT", logo: null },
  homeScore: 1,
  awayScore: 0,
  goals: [{ side: "home", clock: "29'", scorer: "Alajbegovic", type: "Goal", ownGoal: false, penalty: false }],
  cards: [{ side: "away", clock: "55'", player: "Hassan", kind: "yellow" }],
};

describe("eventMinute", () => {
  it("parses plain and stoppage-time clocks", () => {
    expect(eventMinute("29'")).toBe(29);
    expect(eventMinute("45'+2'")).toBe(47);
  });
});

describe("buildTimeline", () => {
  it("merges substitutions with goals + cards in chronological order", () => {
    const subs = [
      { side: "home" as const, clock: "62'", playerIn: "Demirovic", playerOut: "Dzeko" },
      { side: "away" as const, clock: "12'", playerIn: "In2", playerOut: "Out2" },
    ];
    const tl = buildTimeline(base, "#0f0", "#f00", subs);
    expect(tl.map((e) => e.kind)).toEqual(["sub", "goal", "yellow", "sub"]);
    expect(tl[0]).toMatchObject({ kind: "sub", minute: 12, player: "In2", playerOut: "Out2" });
    // the home sub carries the home accent
    expect(tl.find((e) => e.minute === 62)).toMatchObject({ kind: "sub", color: "#0f0", player: "Demirovic" });
  });

  it("omits subs when none are passed (backward compatible)", () => {
    const tl = buildTimeline(base, "#0f0", "#f00");
    expect(tl).toHaveLength(2);
    expect(tl.some((e) => e.kind === "sub")).toBe(false);
  });
});
