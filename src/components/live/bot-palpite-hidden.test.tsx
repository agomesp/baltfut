import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DuoGameCard } from "@/components/live/prematch-panel";
import type { Match } from "@/lib/espn";
import type { VoteEntry, CastVoteTransport } from "@/lib/votes";

// The house bot "ChatGPT" palpites every game. Its pick must stay hidden from a
// match's feed until that match's palpite window closes, so viewers can't copy
// the AI before locking in their own — then it's revealed like everyone else's.

const match: Match = {
  id: "m1", league: "fifa.world", name: "CRO v GHA", shortName: "CRO v GHA",
  startsAt: "2026-06-27T18:00:00Z", state: "pre", isLive: false, statusDetail: "",
  displayClock: null, venue: null,
  home: { id: "h", name: "Croatia", abbreviation: "CRO", logo: null },
  away: { id: "a", name: "Ghana", abbreviation: "GHA", logo: null },
  homeScore: null, awayScore: null, homeShootout: null, awayShootout: null, goals: [], cards: [],
};

const entry = (username: string, predHome: number, predAway: number): VoteEntry => ({
  matchId: "m1", league: "fifa.world", username, predHome, predAway, createdAt: "2026-06-27T17:00:00Z",
});

// openUntil (a finite ms) overrides the deadline, so the window state is decided
// purely by whether it's in the future (open) or the past (closed).
function renderCard(openUntil: number) {
  return render(
    <DuoGameCard
      match={match}
      entries={[entry("ChatGPT", 2, 1), entry("ana", 0, 0)]}
      groupByTeam={{}}
      name=""
      confirm={vi.fn()}
      released
      openUntil={openUntil}
      borderColor="#000"
      transport={vi.fn<CastVoteTransport>()}
      onVoted={vi.fn()}
    />,
  );
}

describe("DuoGameCard — ChatGPT palpite hidden until the window closes", () => {
  it("OPEN: the bot's pick is withheld; human palpites still show", () => {
    renderCard(Date.now() + 3_600_000); // closes in 1h → open
    expect(screen.queryByText("ChatGPT")).toBeNull();
    expect(screen.queryByText("CRO 2 × 1 GHA")).toBeNull(); // the bot's scoreline
    expect(screen.getByText("ana")).toBeInTheDocument();
    expect(screen.getByText("CRO 0 × 0 GHA")).toBeInTheDocument();
  });

  it("CLOSED: the bot's pick is revealed alongside everyone else's", () => {
    renderCard(Date.now() - 3_600_000); // closed 1h ago
    expect(screen.getByText("ChatGPT")).toBeInTheDocument();
    expect(screen.getByText("CRO 2 × 1 GHA")).toBeInTheDocument();
    expect(screen.getByText("ana")).toBeInTheDocument();
  });
});
