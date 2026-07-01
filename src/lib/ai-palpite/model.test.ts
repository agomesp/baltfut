import { describe, expect, it } from "vitest";
import { buildAiPalpites } from "@/lib/ai-palpite/model";
import type { Match, MatchState } from "@/lib/espn";

function team(code: string, name = code) {
  return { id: code, name, abbreviation: code, logo: null };
}

interface MOpts {
  stage?: string;
  homeScore?: number | null;
  awayScore?: number | null;
}

function m(
  id: string,
  homeCode: string,
  awayCode: string,
  state: MatchState,
  startsAt: string,
  { stage, homeScore = null, awayScore = null }: MOpts = {},
): Match {
  return {
    id,
    league: "fifa.world",
    stage,
    name: `${homeCode} v ${awayCode}`,
    shortName: `${homeCode} v ${awayCode}`,
    startsAt,
    state,
    isLive: state === "in",
    statusDetail: "",
    displayClock: null,
    venue: null,
    home: team(homeCode),
    away: team(awayCode),
    homeScore: state === "pre" ? null : homeScore,
    awayScore: state === "pre" ? null : awayScore,
    goals: [],
    cards: [],
  };
}

describe("buildAiPalpites", () => {
  it("predicts a scoreline for every upcoming match, chronologically", () => {
    const matches = [
      m("2", "ARG", "CRC", "pre", "2026-06-25T16:00Z"),
      m("1", "BRA", "HAI", "pre", "2026-06-24T16:00Z"),
      m("0", "ENG", "USA", "post", "2026-06-20T16:00Z", { homeScore: 2, awayScore: 0 }),
    ];
    const model = buildAiPalpites(matches);
    expect(model.upcoming.map((u) => u.match.id)).toEqual(["1", "2"]);
    expect(model.upcoming[0].score.winner).toBe("home"); // BRA over HAI
  });

  it("skips upcoming fixtures whose opponent is still a seed", () => {
    const matches = [
      m("real", "BRA", "JPN", "pre", "2026-06-24T16:00Z"),
      m("seed", "GER", "Third Place Group A/B/C", "pre", "2026-07-04T16:00Z", {
        stage: "round-of-16",
      }),
    ];
    const model = buildAiPalpites(matches);
    expect(model.upcoming.map((u) => u.match.id)).toEqual(["real"]);
  });

  it("picks the highest-rated alive team as champion", () => {
    const matches = [
      m("1", "BRA", "HAI", "pre", "2026-06-24T16:00Z"),
      m("2", "ARG", "CRC", "pre", "2026-06-25T16:00Z"),
      m("3", "FRA", "PAN", "pre", "2026-06-26T16:00Z"),
    ];
    const model = buildAiPalpites(matches);
    expect(model.champion?.code).toBe("FRA"); // 91 is the top rating present
    expect(model.ranking[0].code).toBe("FRA");
  });

  it("drops a team eliminated in the knockout from the champion pick", () => {
    const matches = [
      // FRA loses its round-of-16 tie -> out of contention
      m("ko", "FRA", "ARG", "post", "2026-07-05T16:00Z", {
        stage: "round-of-16",
        homeScore: 0,
        awayScore: 1,
      }),
      m("g1", "ESP", "MAR", "pre", "2026-06-24T16:00Z"),
    ];
    const model = buildAiPalpites(matches);
    expect(model.ranking.map((r) => r.code)).not.toContain("FRA");
    expect(model.champion?.code).toBe("ARG"); // 90, ahead of ESP 90 by alpha? ARG<ESP
  });

  it("eliminates the side that lost a knockout tie on penalties", () => {
    const matches = [
      // GER 1–1 PAR, Paraguay through on penalties (3–4). GER is out.
      m("ko", "GER", "PAR", "post", "2026-06-29T20:30Z", {
        stage: "round-of-32",
        homeScore: 1,
        awayScore: 1,
      }),
      m("g1", "ESP", "MAR", "pre", "2026-06-24T16:00Z"),
    ];
    matches[0].homeShootout = 3;
    matches[0].awayShootout = 4;
    const model = buildAiPalpites(matches);
    const codes = model.ranking.map((r) => r.code);
    expect(codes).not.toContain("GER");
    expect(codes).toContain("PAR");
  });

  it("projects decided knockout ties and leaves seeded slots open", () => {
    const matches = [
      m("ko1", "BRA", "JAM", "pre", "2026-07-01T16:00Z", { stage: "round-of-32" }),
      m("ko2", "Group A 1st Place", "Group B 2nd Place", "pre", "2026-07-01T19:00Z", {
        stage: "round-of-32",
      }),
    ];
    const model = buildAiPalpites(matches);
    const r32 = model.knockout.find((c) => c.slug === "round-of-32");
    expect(r32).toBeDefined();
    const [decided, seeded] = r32!.ties;
    expect(decided.advances).toBe("BRA");
    expect(decided.score).not.toBeNull();
    expect(seeded.advances).toBeNull();
    expect(seeded.score).toBeNull();
  });
});
