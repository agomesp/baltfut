import { describe, expect, it } from "vitest";
import { buildAiPalpiteItems } from "@/lib/ai-palpite/pull-core.mjs";
import { predictMatch, strongerCode } from "@/lib/ai-palpite/core.mjs";

/** Minimal ESPN scoreboard event, shaped like the real payload's used fields. */
function event({ id, home, away, homeName, awayName, state = "pre", slug = "2026" }: {
  id: string;
  home: string;
  away: string;
  homeName?: string;
  awayName?: string;
  state?: "pre" | "in" | "post";
  slug?: string;
}) {
  return {
    id,
    season: { slug },
    status: { type: { state } },
    competitions: [
      {
        competitors: [
          { homeAway: "home", team: { abbreviation: home, displayName: homeName ?? home } },
          { homeAway: "away", team: { abbreviation: away, displayName: awayName ?? away } },
        ],
      },
    ],
  };
}

describe("buildAiPalpiteItems", () => {
  it("predicts every fixture with two decided teams, using the shared model", () => {
    const items = buildAiPalpiteItems([event({ id: "1", home: "BRA", away: "HAI" })], "fifa.world");
    const score = predictMatch("BRA", "HAI");
    expect(items).toEqual([
      { match_id: "1", league: "fifa.world", pred_home: score.home, pred_away: score.away, pen_winner: null },
    ]);
  });

  it("backfills finished (post) and live (in) matches, not just upcoming", () => {
    const items = buildAiPalpiteItems(
      [
        event({ id: "1", home: "FRA", away: "NZL", state: "post" }),
        event({ id: "2", home: "ESP", away: "CPV", state: "in" }),
      ],
      "fifa.world",
    );
    expect(items.map((i) => i.match_id)).toEqual(["1", "2"]);
  });

  it("skips ties still on placeholder seeds (undecided teams)", () => {
    const items = buildAiPalpiteItems(
      [event({ id: "9", home: "A1", away: "BRA", homeName: "Winner Group A", slug: "round-of-16" })],
      "fifa.world",
    );
    expect(items).toEqual([]);
  });

  it("skips events missing a competitor", () => {
    const broken = { id: "5", competitions: [{ competitors: [{ homeAway: "home", team: { abbreviation: "BRA", displayName: "Brazil" } }] }] };
    expect(buildAiPalpiteItems([broken], "fifa.world")).toEqual([]);
  });

  it("on a knockout tie the model calls level, records the stronger side as the pen winner", () => {
    // CZE (70) vs MEX (74) → predictScore gap is small; verify it's a draw first.
    const s = predictMatch("CZE", "MEX");
    expect(s.winner).toBe("draw");
    const items = buildAiPalpiteItems(
      [event({ id: "7", home: "CZE", away: "MEX", slug: "round-of-16" })],
      "fifa.world",
    );
    const expected = strongerCode("CZE", "MEX") === "CZE" ? "home" : "away";
    expect(items[0].pen_winner).toBe(expected); // MEX stronger → "away"
  });

  it("does not record a pen winner for a decisive knockout prediction", () => {
    const items = buildAiPalpiteItems(
      [event({ id: "8", home: "BRA", away: "HAI", slug: "final" })],
      "fifa.world",
    );
    expect(predictMatch("BRA", "HAI").winner).toBe("home");
    expect(items[0].pen_winner).toBeNull();
  });

  it("does not record a pen winner for a group-stage draw (no shootout)", () => {
    const items = buildAiPalpiteItems(
      [event({ id: "3", home: "CZE", away: "MEX", slug: "2026" })],
      "fifa.world",
    );
    expect(items[0].pen_winner).toBeNull();
  });

  it("tolerates an empty / missing events array", () => {
    expect(buildAiPalpiteItems([], "fifa.world")).toEqual([]);
    // @ts-expect-error — exercising the undefined guard
    expect(buildAiPalpiteItems(undefined, "fifa.world")).toEqual([]);
  });
});
