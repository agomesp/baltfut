import { describe, expect, it } from "vitest";
import type { Match, Team } from "@/lib/espn";
import { teamCupHistory } from "@/lib/team-history";

function team(abbr: string, name = abbr): Team {
  return { id: abbr, name, abbreviation: abbr, logo: null };
}

function mkMatch(p: {
  id: string;
  startsAt: string;
  home: string;
  away: string;
  hs: number | null;
  as: number | null;
  state?: Match["state"];
}): Match {
  return {
    id: p.id,
    league: "fifa.world",
    name: `${p.home} v ${p.away}`,
    shortName: `${p.home} @ ${p.away}`,
    startsAt: p.startsAt,
    state: p.state ?? "post",
    isLive: false,
    statusDetail: "FT",
    displayClock: null,
    venue: null,
    home: team(p.home),
    away: team(p.away),
    homeScore: p.hs,
    awayScore: p.as,
    goals: [],
    cards: [],
  };
}

const FIXTURES: Match[] = [
  mkMatch({ id: "1", startsAt: "2026-06-12T18:00Z", home: "PAN", away: "KSA", hs: 2, as: 1 }),
  mkMatch({ id: "2", startsAt: "2026-06-16T18:00Z", home: "JPN", away: "PAN", hs: 0, as: 0 }),
  mkMatch({ id: "3", startsAt: "2026-06-20T18:00Z", home: "PAN", away: "SEN", hs: 1, as: 3 }),
  mkMatch({ id: "4", startsAt: "2026-06-25T18:00Z", home: "PAN", away: "CRO", hs: null, as: null, state: "pre" }),
];

describe("teamCupHistory", () => {
  it("returns the team's finished games newest-first, oriented to the team", () => {
    const h = teamCupHistory(FIXTURES, "PAN");
    expect(h).toEqual([
      { opp: "SEN", oppCode: "SEN", score: "1–3", res: "D" }, // PAN home, lost
      { opp: "JPN", oppCode: "JPN", score: "0–0", res: "E" }, // PAN away, draw
      { opp: "KSA", oppCode: "KSA", score: "2–1", res: "V" }, // PAN home, won
    ]);
  });

  it("orients score and result to the queried team when it played away", () => {
    const [latest] = teamCupHistory(FIXTURES, "SEN");
    expect(latest).toEqual({ opp: "PAN", oppCode: "PAN", score: "3–1", res: "V" });
  });

  it("ignores unfinished matches and respects the limit", () => {
    expect(teamCupHistory(FIXTURES, "PAN", 2)).toHaveLength(2);
    expect(teamCupHistory(FIXTURES, "CRO")).toEqual([]); // only an upcoming game
  });
});
