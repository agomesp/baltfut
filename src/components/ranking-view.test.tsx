import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RankingView } from "@/components/ranking-view";
import type { Match } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";

const finished = (id: string, home: number, away: number): Match => ({
  id,
  league: "fifa.world",
  name: "Home at Away",
  shortName: "H @ A",
  startsAt: "2026-06-21T16:00Z",
  state: "post",
  isLive: false,
  statusDetail: "FT",
  displayClock: null,
  venue: null,
  home: { id: "1", name: "Home", abbreviation: "H", logo: null },
  away: { id: "2", name: "Away", abbreviation: "A", logo: null },
  homeScore: home,
  awayScore: away,
  goals: [],
  cards: [],
});

const entry = (username: string, matchId: string, ph: number, pa: number): VoteEntry => ({
  matchId,
  league: "fifa.world",
  username,
  predHome: ph,
  predAway: pa,
  createdAt: "2026-06-21T16:00:00Z",
});

describe("RankingView — host (Rodrigo Baltar) row", () => {
  it("paints the host's name in RB-brand blue, leaving other subs untouched", () => {
    render(
      <RankingView
        entries={[entry("Rodrigo Baltar", "m1", 1, 0), entry("Ana", "m1", 0, 0)]}
        matches={[finished("m1", 1, 0)]}
      />,
    );
    expect(screen.getByText("Rodrigo Baltar")).toHaveStyle({ color: "#3b82f6" });
    expect(screen.getByText("Ana")).not.toHaveStyle({ color: "#3b82f6" });
  });
});
