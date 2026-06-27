import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveDuoCard } from "@/components/live/live-duo-card";
import type { Match, MatchState } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";

// The hero is heavy (cinematic/crests) and irrelevant here — stub it out so this
// test is about the palpite bucketing only.
vi.mock("@/components/live/hero-with-cinematic", () => ({
  HeroWithCinematic: () => null,
}));

function match(hs: number, as: number, state: MatchState = "in"): Match {
  return {
    id: "m1",
    league: "fifa.world",
    name: "CRO v GHA",
    shortName: "CRO v GHA",
    startsAt: "2026-06-27T18:00:00Z",
    state,
    isLive: state === "in",
    statusDetail: "",
    displayClock: "10'",
    venue: null,
    home: { id: "h", name: "Croatia", abbreviation: "CRO", logo: null },
    away: { id: "a", name: "Ghana", abbreviation: "GHA", logo: null },
    homeScore: hs,
    awayScore: as,
    goals: [],
    cards: [],
  };
}

const entry: VoteEntry = {
  matchId: "m1",
  league: "fifa.world",
  username: "tester",
  predHome: 1,
  predAway: 0,
  createdAt: "2026-06-27T17:00:00Z",
};

describe("LiveDuoCard — memoized live split must not go stale on a goal", () => {
  it("re-buckets a palpite when the score changes (same entries ref, only score differs)", () => {
    // Pass the SAME entries array across both renders, so the ONLY changed memo
    // dep is the score — this fails if someone drops hs/as from the deps.
    const entries = [entry];

    const { rerender } = render(<LiveDuoCard match={match(0, 0)} entries={entries} groupLabel="GRUPO L" />);
    // At 0–0, a 1–0 prediction is still reachable, not an exact hit.
    expect(screen.queryByText("CRAVOU O PLACAR")).toBeNull();

    // ⚽ Goal: 1–0 now matches the 1–0 prediction exactly → it must flip to "cravou".
    rerender(<LiveDuoCard match={match(1, 0)} entries={entries} groupLabel="GRUPO L" />);
    expect(screen.getByText("CRAVOU O PLACAR")).toBeInTheDocument();
  });
});
