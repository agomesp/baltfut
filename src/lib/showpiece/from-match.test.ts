import { describe, it, expect } from "vitest";
import type { Match, MatchState } from "@/lib/espn";
import { FINAL_THEME, THIRD_THEME } from "@/lib/showpiece/dossiers";
import { showpieceThemeFor, realPath, scenarioFromMatch } from "@/lib/showpiece/from-match";

function m(
  id: string,
  stage: string,
  home: string,
  away: string,
  hs: number | null,
  as: number | null,
  state: MatchState = "post",
  startsAt = "2026-07-01T18:00:00Z",
): Match {
  return {
    id,
    league: "fifa.world",
    stage,
    name: `${away} at ${home}`,
    shortName: `${away} @ ${home}`,
    startsAt,
    state,
    isLive: state === "in",
    statusDetail: "",
    displayClock: null,
    venue: null,
    home: { id: `${id}h`, name: home, abbreviation: home, logo: null },
    away: { id: `${id}a`, name: away, abbreviation: away, logo: null },
    homeScore: hs,
    awayScore: as,
    homeShootout: null,
    awayShootout: null,
    goals: [],
    cards: [],
  };
}

// The real bracket shape: ESP and ARG each win four knockout rounds → the final.
const WORLD: Match[] = [
  m("g1", "group-stage", "ESP", "CPV", 3, 0, "post", "2026-06-15T16:00:00Z"),
  m("r32e", "round-of-32", "ESP", "AUT", 3, 0, "post", "2026-07-02T19:00:00Z"),
  m("r16e", "round-of-16", "POR", "ESP", 0, 1, "post", "2026-07-06T19:00:00Z"),
  m("qfe", "quarterfinals", "ESP", "BEL", 2, 1, "post", "2026-07-10T19:00:00Z"),
  m("sfe", "semifinals", "FRA", "ESP", 0, 2, "post", "2026-07-14T19:00:00Z"),
  m("r32a", "round-of-32", "ARG", "CPV", 3, 2, "post", "2026-07-03T22:00:00Z"),
  m("sfa", "semifinals", "ENG", "ARG", 1, 2, "post", "2026-07-15T19:00:00Z"),
  m("third", "3rd-place-match", "FRA", "ENG", null, null, "pre", "2026-07-18T21:00:00Z"),
  m("final", "final", "ESP", "ARG", null, null, "pre", "2026-07-19T19:00:00Z"),
];

const finalMatch = WORLD.find((x) => x.id === "final")!;
const thirdMatch = WORLD.find((x) => x.id === "third")!;

describe("showpieceThemeFor", () => {
  it("maps the marquee stages to their theme", () => {
    expect(showpieceThemeFor(finalMatch)).toBe(FINAL_THEME);
    expect(showpieceThemeFor(thirdMatch)).toBe(THIRD_THEME);
  });

  it("is null for every ordinary fixture", () => {
    expect(showpieceThemeFor(WORLD.find((x) => x.id === "g1")!)).toBeNull();
    expect(showpieceThemeFor(WORLD.find((x) => x.id === "sfe")!)).toBeNull();
    expect(showpieceThemeFor({ ...finalMatch, stage: undefined })).toBeNull();
  });
});

describe("realPath", () => {
  it("derives the team's knockout run: own score first, chronological, pt-BR labels", () => {
    expect(realPath("ESP", WORLD, "final")).toEqual([
      { round: "32-AVOS", opp: "AUT", score: "3–0", won: true },
      { round: "OITAVAS", opp: "POR", score: "1–0", won: true }, // ESP were AWAY → own score first
      { round: "QUARTAS", opp: "BEL", score: "2–1", won: true },
      { round: "SEMIFINAL", opp: "FRA", score: "2–0", won: true },
    ]);
  });

  it("excludes the group stage, the current match, and anything unfinished", () => {
    const path = realPath("ESP", WORLD, "final");
    expect(path.some((l) => l.opp === "CPV")).toBe(false); // group stage
    expect(path.some((l) => l.round === "FINAL")).toBe(false); // the tie being shown
  });

  it("marks a defeat as not won (France lost the semi)", () => {
    expect(realPath("FRA", WORLD, "third")).toEqual([
      { round: "SEMIFINAL", opp: "ESP", score: "0–2", won: false },
    ]);
  });
});

describe("scenarioFromMatch", () => {
  it("builds the final from the REAL match — real home/away and a real path", () => {
    const s = scenarioFromMatch(finalMatch, WORLD)!;
    expect(s.theme).toBe(FINAL_THEME);
    expect(s.match).toBe(finalMatch);
    // ESPN has ESP at home for the final — the dossiers must follow reality.
    expect(s.home.code).toBe("ESP");
    expect(s.away.code).toBe("ARG");
    expect(s.home.path.map((l) => l.opp)).toEqual(["AUT", "POR", "BEL", "FRA"]);
    // Knockout goal tallies come from the real run, not the mock constants.
    expect(s.home.koGoalsFor).toBe(8);
    expect(s.home.koGoalsAgainst).toBe(1);
  });

  it("builds the third-place match", () => {
    const s = scenarioFromMatch(thirdMatch, WORLD)!;
    expect(s.theme).toBe(THIRD_THEME);
    expect(s.home.code).toBe("FRA");
    expect(s.away.code).toBe("ENG");
  });

  it("is null for a non-showpiece fixture", () => {
    expect(scenarioFromMatch(WORLD.find((x) => x.id === "sfe")!, WORLD)).toBeNull();
  });

  it("is null when a team has no dossier (unknown finalist)", () => {
    const odd = m("x", "final", "BRA", "NED", null, null, "pre");
    expect(scenarioFromMatch(odd, WORLD)).toBeNull();
  });
});
