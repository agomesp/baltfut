import { describe, it, expect } from "vitest";
import { buildKnockout, seedLabel, isPlaceholderTeam } from "@/lib/espn/bracket";
import type { Match } from "@/lib/espn/types";

function m(id: string, stage: string, startsAt: string): Match {
  return {
    id,
    league: "fifa.world",
    stage,
    name: "",
    shortName: "",
    startsAt,
    state: "pre",
    isLive: false,
    statusDetail: "",
    displayClock: null,
    venue: null,
    home: { id: "h", name: "Home", abbreviation: "HME", logo: null },
    away: { id: "a", name: "Away", abbreviation: "AWY", logo: null },
    homeScore: null,
    awayScore: null,
    goals: [],
    cards: [],
  };
}

describe("buildKnockout", () => {
  it("orders the knockout stages and drops group + empty stages", () => {
    const cols = buildKnockout([
      m("1", "group-stage", "2026-06-11"),
      m("2", "final", "2026-07-19"),
      m("3", "round-of-32", "2026-06-28"),
      m("4", "quarterfinals", "2026-07-10"),
    ]);
    expect(cols.map((c) => c.slug)).toEqual(["round-of-32", "quarterfinals", "final"]);
    expect(cols.map((c) => c.label)).toEqual(["32-avos", "Quartas", "Final"]);
  });

  it("sorts matches within a stage by kickoff", () => {
    const cols = buildKnockout([
      m("late", "round-of-32", "2026-06-29T20:00Z"),
      m("early", "round-of-32", "2026-06-28T16:00Z"),
    ]);
    expect(cols[0].matches.map((x) => x.id)).toEqual(["early", "late"]);
  });
});

describe("isPlaceholderTeam", () => {
  it("flags ESPN placeholder slots, not real teams", () => {
    expect(isPlaceholderTeam("Group H 2nd Place")).toBe(true);
    expect(isPlaceholderTeam("Round of 32 1 Winner")).toBe(true);
    expect(isPlaceholderTeam("Semifinal 1 Loser")).toBe(true);
    expect(isPlaceholderTeam("Switzerland")).toBe(false);
    expect(isPlaceholderTeam("Brazil")).toBe(false);
  });
});

describe("seedLabel", () => {
  it("translates the placeholder patterns to pt-BR", () => {
    expect(seedLabel("Group H 2nd Place")).toBe("2º Grupo H");
    expect(seedLabel("Group K Winner")).toBe("1º Grupo K");
    expect(seedLabel("Third Place Group A/B/C/D/F")).toBe("3º (A/B/C/D/F)");
    expect(seedLabel("Round of 32 1 Winner")).toBe("Venc. 32-avos 1");
    expect(seedLabel("Quarterfinal 3 Winner")).toBe("Venc. quartas 3");
    expect(seedLabel("Semifinal 2 Loser")).toBe("Perd. semi 2");
  });

  it("passes a real team name through unchanged", () => {
    expect(seedLabel("Brazil")).toBe("Brazil");
  });
});
