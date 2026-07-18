import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Match, MatchState } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import type { MatchResult } from "@/lib/ranking";
import { useSubRanks } from "@/lib/use-sub-ranks";

// The ranking is assembled in ONE place now (useSubRanks) and consumed by both
// RankingSubs and the showpiece. These lock the composition it performs — the
// durable-results override and the bracket-points fold — because a caller
// silently dropping one of those inputs has shipped as a bug before.

function match(id: string, hs: number | null, as: number | null, state: MatchState = "post"): Match {
  return {
    id,
    league: "fifa.world",
    stage: "group-stage",
    name: "A v B",
    shortName: "A v B",
    startsAt: "2026-06-20T18:00:00Z",
    state,
    isLive: state === "in",
    statusDetail: "",
    displayClock: null,
    venue: null,
    home: { id: `${id}h`, name: "A", abbreviation: "AAA", logo: null },
    away: { id: `${id}a`, name: "B", abbreviation: "BBB", logo: null },
    homeScore: hs,
    awayScore: as,
    homeShootout: null,
    awayShootout: null,
    goals: [],
    cards: [],
  };
}

const entry = (username: string, predHome: number, predAway: number): VoteEntry => ({
  matchId: "m1",
  league: "fifa.world",
  username,
  predHome,
  predAway,
  createdAt: "2026-06-20T17:00:00Z",
});

function Harness({
  entries,
  matches,
  results,
}: {
  entries: VoteEntry[];
  matches: Match[];
  results?: Record<string, MatchResult>;
}) {
  const ranks = useSubRanks(entries, matches, results, []);
  return <div data-testid="out">{ranks.map((r) => `${r.username}:${r.wins}-${r.losses}`).join("|")}</div>;
}

describe("useSubRanks", () => {
  it("grades on the DURABLE match_results snapshot, not ESPN, when both exist", () => {
    // ESPN says 1–1; the stored snapshot says 2–0. The snapshot must win, so the
    // sub who called 2–0 gets the win and the 1–1 caller does not.
    const matches = [match("m1", 1, 1)];
    const results: Record<string, MatchResult> = {
      m1: { state: "post", homeScore: 2, awayScore: 0, homeShootout: null, awayShootout: null },
    };
    render(<Harness entries={[entry("ana", 2, 0), entry("bob", 1, 1)]} matches={matches} results={results} />);
    expect(screen.getByTestId("out").textContent).toBe("ana:1-0|bob:0-1");
  });

  it("falls back to ESPN for matches with no stored snapshot", () => {
    render(<Harness entries={[entry("ana", 1, 1), entry("bob", 2, 0)]} matches={[match("m1", 1, 1)]} />);
    expect(screen.getByTestId("out").textContent).toBe("ana:1-0|bob:0-1");
  });

  it("ignores matches that haven't finished", () => {
    render(<Harness entries={[entry("ana", 1, 1)]} matches={[match("m1", 1, 1, "in")]} />);
    expect(screen.getByTestId("out").textContent).toBe("");
  });
});
