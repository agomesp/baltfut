import { describe, it, expect } from "vitest";
import {
  parseStandings,
  teamGroupMap,
  standingsUrl,
} from "@/lib/espn/standings";
import fixture from "@/lib/espn/__fixtures__/standings.json";

describe("parseStandings", () => {
  it("parses groups with letters and ranked rows", () => {
    const groups = parseStandings(fixture);
    expect(groups.map((g) => g.letter)).toEqual(["A", "B"]);
    const a = groups[0];
    expect(a.rows.map((r) => r.code)).toEqual(["MEX", "CRO", "ECU", "QAT"]);
    expect(a.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(a.rows[0]).toMatchObject({ played: 2, points: 6, gd: "+3" });
  });

  it("marks the top two (and ESPN advance notes) as advanced", () => {
    const a = parseStandings(fixture)[0];
    expect(a.rows.map((r) => r.advanced)).toEqual([true, true, false, false]);
  });

  it("sorts rows by points then goal difference (ESPN order is unsorted)", () => {
    const groups = parseStandings({
      children: [
        {
          name: "Group Z",
          standings: {
            entries: [
              { team: { abbreviation: "LOW", displayName: "Low" }, stats: [{ name: "points", displayValue: "1" }, { name: "pointDifferential", displayValue: "-2" }] },
              { team: { abbreviation: "TOP", displayName: "Top" }, stats: [{ name: "points", displayValue: "6" }, { name: "pointDifferential", displayValue: "+4" }] },
              { team: { abbreviation: "MID", displayName: "Mid" }, stats: [{ name: "points", displayValue: "3" }, { name: "pointDifferential", displayValue: "0" }] },
            ],
          },
        },
      ],
    });
    expect(groups[0].rows.map((r) => r.code)).toEqual(["TOP", "MID", "LOW"]);
    expect(groups[0].rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("returns [] for non-conforming input", () => {
    expect(parseStandings(null)).toEqual([]);
    expect(parseStandings({})).toEqual([]);
  });
});

describe("teamGroupMap", () => {
  it("maps each team code to its group letter", () => {
    const map = teamGroupMap(parseStandings(fixture));
    expect(map.MEX).toBe("A");
    expect(map.CAN).toBe("B");
  });
});

describe("standingsUrl", () => {
  it("targets the v2 standings endpoint and encodes the league", () => {
    expect(standingsUrl("fifa.world")).toBe(
      "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings",
    );
    expect(standingsUrl("../x")).not.toContain("../");
  });
});
