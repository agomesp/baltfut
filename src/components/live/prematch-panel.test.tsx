import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { Match, MatchState } from "@/lib/espn";
import type { BracketEntry } from "@/lib/bracket-votes";
import type { MatchResult } from "@/lib/ranking";

// Capture the props every RankingSubs render receives, without rendering the real
// (heavy) ranking. This test guards the wiring, not the ranking's own math.
const captured: Record<string, unknown>[] = [];
vi.mock("@/components/live/ranking-subs", () => ({
  RankingSubs: (props: Record<string, unknown>) => {
    captured.push(props);
    return null;
  },
}));
// Heavy children that poll/animate on mount — irrelevant to this wiring test.
vi.mock("@/components/live/ia-vs-voce", () => ({ IaVsVoce: () => null }));
vi.mock("@/components/live/promo-spotlight", () => ({ PromoSpotlight: () => null }));

import { PreMatchPanel } from "@/components/live/prematch-panel";

function preMatch(id: string, home: string, away: string, state: MatchState = "pre"): Match {
  return {
    id,
    league: "fifa.world",
    name: `${home} v ${away}`,
    shortName: `${home} v ${away}`,
    startsAt: "2026-07-20T18:00:00Z",
    state,
    isLive: false,
    statusDetail: "",
    displayClock: "",
    venue: null,
    home: { id: `${id}h`, name: home, abbreviation: home, logo: null },
    away: { id: `${id}a`, name: away, abbreviation: away, logo: null },
    homeScore: null,
    awayScore: null,
    goals: [],
    cards: [],
  };
}

// Sentinels — we only assert they are threaded through, not what they grade to.
const brackets: BracketEntry[] = [{ username: "agomesp", picks: { "4-0": "BRA" }, updatedAt: "2026-07-03T00:00:00Z" }];
const results: Record<string, MatchResult> = {
  "760490": { state: "post", homeScore: 1, awayScore: 2, homeShootout: null, awayShootout: null },
};

const base = {
  entries: [],
  secondEntries: [],
  allEntries: [],
  groupByTeam: {},
  releasedIds: new Set<string>(),
  onVoted: () => {},
};

beforeEach(() => {
  captured.length = 0;
});

describe("PreMatchPanel — the pre-match ranking must fold in bracket points + durable results", () => {
  // Regression: the pre-match panel rendered RankingSubs WITHOUT brackets/results,
  // so between matches everyone's total dropped to score-palpite hits only (bracket
  // 0.2-per-winner points vanished). Both call sites (single + duo) must forward them.
  it("forwards brackets and results to the ranking (single game)", () => {
    const m1 = preMatch("m1", "CRO", "GHA");
    render(<PreMatchPanel match={m1} second={null} matches={[m1]} brackets={brackets} results={results} {...base} />);

    expect(captured.length).toBeGreaterThan(0);
    expect(captured[0].brackets).toBe(brackets);
    expect(captured[0].results).toBe(results);
  });

  it("forwards brackets and results to the ranking (concurrent duo)", () => {
    const m1 = preMatch("m1", "CRO", "GHA");
    const m2 = preMatch("m2", "BRA", "ARG");
    render(<PreMatchPanel match={m1} second={m2} matches={[m1, m2]} brackets={brackets} results={results} {...base} />);

    expect(captured.some((p) => p.brackets === brackets && p.results === results)).toBe(true);
  });
});
