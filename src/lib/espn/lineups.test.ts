import { describe, it, expect } from "vitest";
import { parseLineups, summaryUrl } from "@/lib/espn/lineups";
import fixture from "@/lib/espn/__fixtures__/summary.json";

describe("parseLineups", () => {
  it("returns home/away lineups with formation and starters only", () => {
    const lineups = parseLineups(fixture)!;
    expect(lineups.home.code).toBe("FRA");
    expect(lineups.home.formation).toBe("4-3-3");
    // 3 starters; the non-starter keeper is excluded.
    expect(lineups.home.players).toHaveLength(3);
    expect(lineups.away.code).toBe("GER");
  });

  it("maps single-letter positions to GK/DF/MF/FW and orders by formation place", () => {
    const home = parseLineups(fixture)!.home;
    expect(home.players[0]).toMatchObject({ number: "1", pos: "GK", name: "M. Maignan" });
    // formationPlace 1, 8, 10 -> GK, MF, FW order
    expect(home.players.map((p) => p.pos)).toEqual(["GK", "MF", "FW"]);
  });

  it("returns null when lineups are unavailable", () => {
    expect(parseLineups({})).toBeNull();
    expect(parseLineups({ rosters: [] })).toBeNull();
    expect(parseLineups(null)).toBeNull();
  });
});

describe("summaryUrl", () => {
  it("builds the summary endpoint with an encoded event id", () => {
    expect(summaryUrl("760453", "fifa.world")).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=760453",
    );
  });
});
