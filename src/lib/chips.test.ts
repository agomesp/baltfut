import { describe, it, expect } from "vitest";
import { buildChipGames, defaultChipId } from "@/lib/chips";
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

describe("defaultChipId", () => {
  it("prefers a live game, then the next upcoming, then the most recent finished", () => {
    expect(defaultChipId(buildChipGames(matches, counts))).toBe("live1");
    const noLive = matches.filter((x) => !x.isLive);
    expect(defaultChipId(buildChipGames(noLive, counts))).toBe("preSoon");
    const onlyPost = matches.filter((x) => x.state === "post");
    expect(defaultChipId(buildChipGames(onlyPost, counts))).toBe("postVotesNew");
  });
});
