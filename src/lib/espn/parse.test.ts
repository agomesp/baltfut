import { describe, it, expect } from "vitest";
import { parseScoreboard } from "@/lib/espn/parse";
import { matchShootout } from "@/lib/espn/result";
import fixture from "@/lib/espn/__fixtures__/scoreboard.json";

const LEAGUE = "fifa.world";

/** A knockout decided on penalties: ESPN reports the level 90'/AET `score` plus a
 *  per-competitor `shootoutScore` (a number) and `status.type.shortDetail "FT-Pens"`. */
function shootoutScoreboard() {
  return {
    events: [
      {
        id: "k1",
        date: "2026-07-01T16:00Z",
        shortName: "FRA @ ARG",
        status: { type: { state: "post", detail: "Full Time - Penalties", shortDetail: "FT-Pens" } },
        competitions: [
          {
            competitors: [
              { homeAway: "home", score: "3", shootoutScore: 4, team: { id: "1", displayName: "Argentina", abbreviation: "ARG" } },
              { homeAway: "away", score: "3", shootoutScore: 2, team: { id: "2", displayName: "France", abbreviation: "FRA" } },
            ],
          },
        ],
      },
    ],
  };
}

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
    // 4 goals (incl. an own goal); the yellow/red cards are excluded.
    expect(live.goals).toHaveLength(4);
    const home = live.goals.filter((g) => g.side === "home");
    const away = live.goals.filter((g) => g.side === "away");
    expect(home).toHaveLength(1); // France penalty
    expect(away).toHaveLength(3); // Germany x2 + an own goal credited to Germany
    expect(home[0]).toMatchObject({ clock: "41'", scorer: "Mbappé" });
    expect(away.map((g) => g.scorer)).toEqual(["Havertz", "Wirtz", "Upamecano"]);
  });

  it("flags penalty and own-goal scoring plays", () => {
    const live = parseScoreboard(fixture, LEAGUE).find((m) => m.id === "1002")!;
    const pen = live.goals.find((g) => g.scorer === "Mbappé")!;
    expect(pen).toMatchObject({ penalty: true, ownGoal: false });
    // Own goal is credited to the benefiting side (Germany), not flipped.
    const og = live.goals.find((g) => g.scorer === "Upamecano")!;
    expect(og).toMatchObject({ ownGoal: true, side: "away" });
    const open = live.goals.find((g) => g.scorer === "Havertz")!;
    expect(open).toMatchObject({ penalty: false, ownGoal: false });
  });

  it("extracts yellow and red cards with side and player", () => {
    const live = parseScoreboard(fixture, LEAGUE).find((m) => m.id === "1002")!;
    expect(live.cards).toHaveLength(2);
    const yellow = live.cards.find((c) => c.kind === "yellow")!;
    expect(yellow).toMatchObject({ side: "home", clock: "70'", player: "Tchouaméni" });
    const red = live.cards.find((c) => c.kind === "red")!;
    expect(red).toMatchObject({ side: "away", clock: "82'", player: "Rüdiger" });
  });

  it("has no goals or cards for matches without scoring details", () => {
    const pre = parseScoreboard(fixture, LEAGUE).find((m) => m.id === "1001")!;
    expect(pre.goals).toEqual([]);
    expect(pre.cards).toEqual([]);
  });

  it("captures the penalty-shootout tally and keeps the level 90'/AET score", () => {
    const m = parseScoreboard(shootoutScoreboard(), LEAGUE)[0];
    expect(m.homeScore).toBe(3);
    expect(m.awayScore).toBe(3);
    expect(m.homeShootout).toBe(4);
    expect(m.awayShootout).toBe(2);
    expect(m.statusDetail).toBe("FT-Pens");
  });

  it("leaves shootout fields null for a non-shootout match", () => {
    const done = parseScoreboard(fixture, LEAGUE).find((m) => m.id === "1003")!;
    expect(done.homeShootout).toBeNull();
    expect(done.awayShootout).toBeNull();
  });

  it("matchShootout resolves the winner from the tally (null when not a shootout)", () => {
    const m = parseScoreboard(shootoutScoreboard(), LEAGUE)[0];
    expect(matchShootout(m)).toEqual({ home: 4, away: 2, winner: "home" });
    const done = parseScoreboard(fixture, LEAGUE).find((mm) => mm.id === "1003")!;
    expect(matchShootout(done)).toBeNull();
  });

  it("returns an empty array for non-conforming input instead of throwing", () => {
    expect(parseScoreboard(null, LEAGUE)).toEqual([]);
    expect(parseScoreboard({}, LEAGUE)).toEqual([]);
    expect(parseScoreboard({ events: "nope" }, LEAGUE)).toEqual([]);
  });
});
