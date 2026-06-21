import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoteForm } from "@/components/vote-form";
import type { Match } from "@/lib/espn";
import type { CastVoteTransport } from "@/lib/votes/submit";

const match: Match = {
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

describe("VoteForm", () => {
  it("renders the name field and a submit button", () => {
    render(<VoteForm match={match} transport={vi.fn<CastVoteTransport>()} />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit vote/i }),
    ).toBeInTheDocument();
  });

  it("blocks invalid submissions and never hits the network", async () => {
    const transport = vi.fn<CastVoteTransport>();
    render(<VoteForm match={match} transport={transport} />);
    await userEvent.click(screen.getByRole("button", { name: /submit vote/i }));
    expect(transport).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/fix the highlighted fields/i),
    ).toBeInTheDocument();
  });

  it("submits a valid vote and confirms success", async () => {
    const transport = vi.fn<CastVoteTransport>(async () => ({ status: 201, body: { ok: true } }));
    const onVoted = vi.fn();
    render(<VoteForm match={match} transport={transport} onVoted={onVoted} />);

    await userEvent.type(screen.getByLabelText(/name/i), "Allan");
    await userEvent.click(screen.getByRole("button", { name: "France" }));
    await userEvent.click(screen.getByRole("button", { name: /submit vote/i }));

    expect(transport).toHaveBeenCalledOnce();
    expect(transport.mock.calls[0][0]).toMatchObject({
      matchId: "1002",
      username: "Allan",
      preferredSide: "home",
      preferredTeamAbbr: "FRA",
    });
    expect(await screen.findByText(/thanks/i)).toBeInTheDocument();
    expect(onVoted).toHaveBeenCalled();
  });

  it("shows the already-voted message on 409", async () => {
    const transport = vi.fn<CastVoteTransport>(async () => ({ status: 409, body: {} }));
    render(<VoteForm match={match} transport={transport} />);
    await userEvent.type(screen.getByLabelText(/name/i), "Allan");
    await userEvent.click(screen.getByRole("button", { name: "Germany" }));
    await userEvent.click(screen.getByRole("button", { name: /submit vote/i }));
    expect(await screen.findByText(/already voted/i)).toBeInTheDocument();
  });
});
