import { describe, it, expect } from "vitest";
import { buildChipGames, defaultChipId, groupConcurrentChips, groupPrimaryId, type ChipGame } from "@/lib/chips";
import type { Match, MatchState } from "@/lib/espn";

function m(id: string, state: MatchState, startsAt: string, isLive = false): Match {
  return {
    id,
    league: "fifa.world",
    name: id,
    shortName: id,
    startsAt,
    state,
    isLive,
    statusDetail: "",
    displayClock: null,
    venue: null,
    home: { id: "h", name: "H", abbreviation: "H", logo: null },
    away: { id: "a", name: "A", abbreviation: "A", logo: null },
    homeScore: state === "pre" ? null : 1,
    awayScore: state === "pre" ? null : 0,
    goals: [],
    cards: [],
  };
}

const matches = [
  m("postNoVotes", "post", "2026-06-18T16:00Z"),
  m("postVotesOld", "post", "2026-06-19T16:00Z"),
  m("postVotesNew", "post", "2026-06-20T16:00Z"),
  m("live1", "in", "2026-06-21T16:00Z", true),
  m("preSoon", "pre", "2026-06-22T16:00Z"),
  m("preLater", "pre", "2026-06-23T16:00Z"),
];
const counts = { postVotesOld: 2, postVotesNew: 5, live1: 1 };

describe("buildChipGames", () => {
  it("includes finished-with-palpites + live + upcoming, in chronological order", () => {
    const chips = buildChipGames(matches, counts);
    expect(chips.map((c) => c.match.id)).toEqual([
      "postVotesOld",
      "postVotesNew",
      "live1",
      "preSoon",
      "preLater",
    ]);
  });

  it("excludes finished matches with no palpites", () => {
    const chips = buildChipGames(matches, counts);
    expect(chips.find((c) => c.match.id === "postNoVotes")).toBeUndefined();
  });

  it("tags each chip with phase and vote count", () => {
    const chips = buildChipGames(matches, counts);
    const byId = Object.fromEntries(chips.map((c) => [c.match.id, c]));
    expect(byId.live1.phase).toBe("live");
    expect(byId.postVotesNew).toMatchObject({ phase: "post", votes: 5 });
    expect(byId.preSoon).toMatchObject({ phase: "pre", votes: 0 });
  });

  it("respects past/upcoming limits", () => {
    const chips = buildChipGames(matches, counts, { upcomingLimit: 1, pastLimit: 1 });
    expect(chips.filter((c) => c.phase === "pre")).toHaveLength(1);
    expect(chips.filter((c) => c.phase === "post")).toHaveLength(1);
    // pastLimit keeps the most recent finished
    expect(chips.find((c) => c.phase === "post")?.match.id).toBe("postVotesNew");
  });
});

describe("groupConcurrentChips", () => {
  const T0 = Date.parse("2026-06-24T19:00:00Z");
  const MIN = 60_000;
  const iso = (offMin: number) => new Date(T0 + offMin * MIN).toISOString();
  const chip = (id: string, state: MatchState, offMin: number, isLive = false): ChipGame => ({
    match: m(id, state, iso(offMin), isLive),
    votes: 0,
    phase: isLive ? "live" : state === "post" ? "post" : "pre",
  });
  const ids = (groups: ChipGame[][]) => groups.map((g) => g.map((c) => c.match.id));

  it("merges two simultaneous pre games into one group", () => {
    const groups = groupConcurrentChips([chip("a", "pre", 60), chip("b", "pre", 60)], T0);
    expect(ids(groups)).toEqual([["a", "b"]]);
  });

  it("keeps non-overlapping games as separate single groups", () => {
    const groups = groupConcurrentChips([chip("a", "pre", 0), chip("b", "pre", 300)], T0 - 60 * MIN);
    expect(ids(groups)).toEqual([["a"], ["b"]]);
  });

  it("merges a live game with its overlapping upcoming neighbour at kickoff", () => {
    const groups = groupConcurrentChips([chip("live", "in", 0, true), chip("next", "pre", 30)], T0);
    expect(ids(groups)).toEqual([["live", "next"]]);
  });

  it("never merges finished games", () => {
    const groups = groupConcurrentChips([chip("done", "post", 0), chip("live", "in", 0, true)], T0 + 30 * MIN);
    expect(ids(groups)).toEqual([["done"], ["live"]]);
  });

  it("groupPrimaryId picks the live game regardless of order", () => {
    const live = chip("live", "in", 0, true);
    const next = chip("next", "pre", 30);
    expect(groupPrimaryId([live, next])).toBe("live");
    expect(groupPrimaryId([next, live])).toBe("live");
  });
});

describe("defaultChipId", () => {
  it("prefers a live game, then the next upcoming, then the most recent finished", () => {
    expect(defaultChipId(buildChipGames(matches, counts))).toBe("live1");
    const noLive = matches.filter((x) => !x.isLive);
    expect(defaultChipId(buildChipGames(noLive, counts))).toBe("preSoon");
    const onlyPost = matches.filter((x) => x.state === "post");
    expect(defaultChipId(buildChipGames(onlyPost, counts))).toBe("postVotesNew");
  });
});
