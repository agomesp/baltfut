import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Match } from "@/lib/espn";

// Keep the page off the network: stub the ESPN fetch and disable Supabase.
vi.mock("@/lib/espn", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/espn")>();
  return { ...actual, fetchScoreboard: vi.fn() };
});
vi.mock("@/lib/supabase/client", () => ({ getSupabaseClient: () => null }));

import Home from "@/app/page";
import { fetchScoreboard } from "@/lib/espn";

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

describe("Home page", () => {
  beforeEach(() => {
    vi.mocked(fetchScoreboard).mockResolvedValue([match]);
  });

  it("loads and renders live matches from ESPN", async () => {
    render(<Home />);
    expect(await screen.findByText("Germany at France")).toBeInTheDocument();
    expect(fetchScoreboard).toHaveBeenCalled();
  });
});
