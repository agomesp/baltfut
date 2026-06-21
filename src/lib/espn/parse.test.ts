import { describe, it, expect } from "vitest";
import { parseScoreboard } from "@/lib/espn/parse";
import fixture from "@/lib/espn/__fixtures__/scoreboard.json";

const LEAGUE = "fifa.world";

describe("parseScoreboard", () => {
  it("drops malformed events and keeps the well-formed ones", () => {
    const matches = parseScoreboard(fixture, LEAGUE);
    // Fixture has 4 events; "1004" is missing a second competitor.
    expect(matches.map((m) => m.id)).toEqual(["1001", "1002", "1003"]);
  });

  it("stamps every match with the league we queried", () => {
    const matches = parseScoreboard(fixture, LEAGUE);
    expect(matches.every((m) => m.league === LEAGUE)).toBe(true);
  });

  it("assigns home/away by the homeAway field, not array order", () => {
    // Event 1002 lists the away team (Germany) first.
    const live = parseScoreboard(fixture, LEAGUE).find((m) => m.id === "1002")!;
    expect(live.home.name).toBe("France");
    expect(live.away.name).toBe("Germany");
    expect(live.homeScore).toBe(1);
    expect(live.awayScore).toBe(2);
  });

  it("marks in-progress matches live and exposes the clock", () => {
    const live = parseScoreboard(fixture, LEAGUE).find((m) => m.id === "1002")!;
    expect(live.state).toBe("in");
    expect(live.isLive).toBe(true);
    expect(live.displayClock).toBe("62'");
    expect(live.statusDetail).toBe("62'");
  });

  it("nulls out scores for matches that have not kicked off", () => {
    const pre = parseScoreboard(fixture, LEAGUE).find((m) => m.id === "1001")!;
    expect(pre.state).toBe("pre");
    expect(pre.isLive).toBe(false);
    expect(pre.homeScore).toBeNull();
    expect(pre.awayScore).toBeNull();
  });

  it("keeps final scores and status for finished matches", () => {
    const done = parseScoreboard(fixture, LEAGUE).find((m) => m.id === "1003")!;
    expect(done.state).toBe("post");
    expect(done.isLive).toBe(false);
    expect(done.homeScore).toBe(3);
    expect(done.awayScore).toBe(1);
    expect(done.statusDetail).toBe("FT");
    expect(done.home.abbreviation).toBe("ESP");
  });

  it("extracts the venue city", () => {
    const live = parseScoreboard(fixture, LEAGUE).find((m) => m.id === "1002")!;
    expect(live.venue).toBe("New York");
  });

  it("extracts goals (incl. penalties), maps scorer side, and skips cards", () => {
    const live = parseScoreboard(fixture, LEAGUE).find((m) => m.id === "1002")!;
    // 3 goals, the yellow card excluded.
    expect(live.goals).toHaveLength(3);
    const home = live.goals.filter((g) => g.side === "home");
    const away = live.goals.filter((g) => g.side === "away");
    expect(home).toHaveLength(1); // France penalty
    expect(away).toHaveLength(2); // Germany x2
    expect(home[0]).toMatchObject({ clock: "41'", scorer: "Mbappé" });
    expect(away.map((g) => g.scorer)).toEqual(["Havertz", "Wirtz"]);
  });

  it("has no goals for matches without scoring details", () => {
    const pre = parseScoreboard(fixture, LEAGUE).find((m) => m.id === "1001")!;
    expect(pre.goals).toEqual([]);
  });

  it("returns an empty array for non-conforming input instead of throwing", () => {
    expect(parseScoreboard(null, LEAGUE)).toEqual([]);
    expect(parseScoreboard({}, LEAGUE)).toEqual([]);
    expect(parseScoreboard({ events: "nope" }, LEAGUE)).toEqual([]);
  });
});
