import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PredictionPanel } from "@/components/prediction-panel";
import type { Match } from "@/lib/espn";
import type { VoteEntry, CastVoteTransport } from "@/lib/votes";

const match: Match = {
  id: "m1",
  league: "fifa.world",
  name: "Germany at France",
  shortName: "GER @ FRA",
  startsAt: "2026-06-21T16:00Z",
  state: "post",
  isLive: false,
  statusDetail: "FT",
  displayClock: null,
  venue: "Paris",
  home: { id: "478", name: "France", abbreviation: "FRA", logo: null },
  away: { id: "503", name: "Germany", abbreviation: "GER", logo: null },
  homeScore: 1,
  awayScore: 2,
  goals: [],
  cards: [],
};

const entry = (username: string, predHome: number, predAway: number): VoteEntry => ({
  matchId: "m1",
  league: "fifa.world",
  username,
  predHome,
  predAway,
  createdAt: "2026-06-21T16:00:00Z",
});

describe("PredictionPanel — finished (post)", () => {
  it("shows winners read-only: no form, exact predictions marked Acertou", () => {
    render(
      <PredictionPanel
        match={match}
        entries={[entry("Bob", 0, 0), entry("Ana", 1, 2)]}
        current={{ home: 1, away: 2 }}
        phase="post"
        closesAt={Date.now() - 1000}
        released={true}
        onVoted={vi.fn()}
        transport={vi.fn<CastVoteTransport>()}
      />,
    );
    expect(screen.getByText("Vencedores dos palpites")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /enviar palpite/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Acertou")).toBeInTheDocument(); // Ana (exact)
    expect(screen.getByText("Errou")).toBeInTheDocument(); // Bob
  });

  it("shows an empty message when nobody predicted", () => {
    render(
      <PredictionPanel
        match={match}
        entries={[]}
        current={{ home: 1, away: 2 }}
        phase="post"
        closesAt={Date.now() - 1000}
        released={true}
        onVoted={vi.fn()}
        transport={vi.fn<CastVoteTransport>()}
      />,
    );
    expect(screen.getByText(/ninguém palpitou/i)).toBeInTheDocument();
  });
});

describe("PredictionPanel — reserved ChatGPT name", () => {
  it("paints the ChatGPT palpite name with a rainbow gradient", () => {
    render(
      <PredictionPanel
        match={match}
        entries={[entry("ChatGPT", 1, 2)]}
        current={{ home: 1, away: 2 }}
        phase="post"
        closesAt={Date.now() - 1000}
        released={true}
        onVoted={vi.fn()}
        transport={vi.fn<CastVoteTransport>()}
      />,
    );
    const name = screen.getByText("ChatGPT");
    expect(name.style.backgroundImage).toContain("linear-gradient");
    expect(name.style.webkitTextFillColor).toBe("transparent");
  });

  it("blocks submitting under a reserved name without calling the transport", () => {
    const transport = vi.fn<CastVoteTransport>();
    render(
      <PredictionPanel
        match={{ ...match, state: "in", isLive: true }}
        entries={[]}
        current={{ home: 1, away: 2 }}
        phase="live"
        closesAt={Date.now() + 600_000}
        released={true}
        onVoted={vi.fn()}
        transport={transport}
      />,
    );
    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Chat GPT" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar palpite/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/reservado/i);
    expect(transport).not.toHaveBeenCalled();
  });
});

describe("PredictionPanel — live/pre", () => {
  it("renders the submit form when the match is live", () => {
    render(
      <PredictionPanel
        match={{ ...match, state: "in", isLive: true }}
        entries={[]}
        current={{ home: 1, away: 2 }}
        phase="live"
        closesAt={Date.now() + 600_000}
        released={true}
        onVoted={vi.fn()}
        transport={vi.fn<CastVoteTransport>()}
      />,
    );
    expect(screen.getByRole("button", { name: /enviar palpite/i })).toBeInTheDocument();
    expect(screen.getByText("Palpite o placar")).toBeInTheDocument();
  });
});
