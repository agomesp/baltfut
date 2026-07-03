import { describe, it, expect } from "vitest";
import {
  knockoutMatchesFromScoreboard,
  startedTeamsByStage,
  dropStartedPicks,
} from "@shared/knockout-lock";

/** Minimal ESPN scoreboard event shape the extractor reads. */
function event(stage: string, state: string, home: string, away: string) {
  return {
    season: { slug: stage },
    status: { type: { state } },
    competitions: [
      { competitors: [
        { homeAway: "home", team: { abbreviation: home } },
        { homeAway: "away", team: { abbreviation: away } },
      ] },
    ],
  };
}

describe("knockoutMatchesFromScoreboard", () => {
  it("keeps knockout events and skips group-stage / malformed ones", () => {
    const json = { events: [
      event("round-of-32", "post", "BRA", "GHA"),
      event("fifa.world.group", "in", "ARG", "MEX"), // group stage → skipped
      { season: { slug: "round-of-16" } },            // malformed (no competitors) → skipped
      event("final", "pre", "FRA", "ESP"),
    ] };
    const out = knockoutMatchesFromScoreboard(json);
    expect(out).toEqual([
      { stage: "round-of-32", state: "post", home: "BRA", away: "GHA" },
      { stage: "final", state: "pre", home: "FRA", away: "ESP" },
    ]);
  });

  it("returns [] for junk input", () => {
    expect(knockoutMatchesFromScoreboard(null)).toEqual([]);
    expect(knockoutMatchesFromScoreboard({})).toEqual([]);
  });
});

describe("startedTeamsByStage", () => {
  it("collects both teams of started (in/post) matches, ignoring pre", () => {
    const started = startedTeamsByStage([
      { stage: "round-of-32", state: "post", home: "BRA", away: "GHA" },
      { stage: "round-of-32", state: "in", home: "FRA", away: "SWE" },
      { stage: "round-of-32", state: "pre", home: "ESP", away: "AUT" }, // not started
    ]);
    expect([...started["round-of-32"]].sort()).toEqual(["BRA", "FRA", "GHA", "SWE"]);
    expect(started["round-of-32"].has("ESP")).toBe(false);
  });
});

describe("dropStartedPicks", () => {
  const started = { "round-of-32": new Set(["BRA", "GHA"]) };

  it("drops a pick whose tie has kicked off, keeps future ones", () => {
    const kept = dropStartedPicks(
      { "0-0": "BRA", "0-5": "FRA", "1-0": "BRA", "4-0": "ESP" },
      started,
    );
    // "0-0":BRA → round-of-32 started for BRA → dropped.
    // "0-5":FRA → round-of-32, FRA not started → kept.
    // "1-0":BRA → round-of-16 (different stage), no lock there → kept (future prediction).
    // "4-0":ESP → final, not started → kept.
    expect(kept).toEqual({ "0-5": "FRA", "1-0": "BRA", "4-0": "ESP" });
  });

  it("is a no-op when nothing has started", () => {
    const picks = { "0-0": "BRA", "4-0": "ESP" };
    expect(dropStartedPicks(picks, {})).toEqual(picks);
  });
});
