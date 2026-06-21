import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchCard } from "@/components/match-card";
import type { Match } from "@/lib/espn";

const liveMatch: Match = {
  id: "1002",
  league: "fifa.world",
  name: "Germany at France",
  shortName: "GER @ FRA",
  startsAt: "2026-06-21T16:00Z",
  state: "in",
  isLive: true,
  statusDetail: "62'",
  displayClock: "62'",
  home: { id: "478", name: "France", abbreviation: "FRA", logo: null },
  away: { id: "503", name: "Germany", abbreviation: "GER", logo: null },
  homeScore: 1,
  awayScore: 2,
};

describe("MatchCard", () => {
  it("renders both teams and the current score", () => {
    render(<MatchCard match={liveMatch} />);
    expect(screen.getByText("France")).toBeInTheDocument();
    expect(screen.getByText("Germany")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("flags live matches with the clock", () => {
    render(<MatchCard match={liveMatch} />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("62'")).toBeInTheDocument();
  });

  it("shows a crowd tally when results are provided", () => {
    render(
      <MatchCard
        match={liveMatch}
        result={{
          matchId: "1002",
          league: "fifa.world",
          totalVotes: 5,
          homeVotes: 3,
          awayVotes: 2,
          avgPredHome: 1.8,
          avgPredAway: 1.2,
        }}
      />,
    );
    expect(screen.getByText("5 votes")).toBeInTheDocument();
  });

  it("hides scores before kickoff", () => {
    const pre: Match = {
      ...liveMatch,
      state: "pre",
      isLive: false,
      statusDetail: "6/22 - 6:00 PM",
      displayClock: null,
      homeScore: null,
      awayScore: null,
    };
    render(<MatchCard match={pre} />);
    expect(screen.queryByText(/live/i)).not.toBeInTheDocument();
    expect(screen.getByText("6/22 - 6:00 PM")).toBeInTheDocument();
  });
});
