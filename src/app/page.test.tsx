import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/espn", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/espn")>();
  return {
    ...actual,
    fetchScoreboard: vi.fn(),
    fetchStandings: vi.fn(),
    fetchLineups: vi.fn(),
  };
});
vi.mock("@/lib/supabase/client", () => ({ getSupabaseClient: () => null }));

import Home from "@/app/page";
import { fetchScoreboard, fetchStandings, fetchLineups } from "@/lib/espn";

describe("Home page", () => {
  beforeEach(() => {
    vi.mocked(fetchScoreboard).mockResolvedValue([]);
    vi.mocked(fetchStandings).mockResolvedValue([]);
    vi.mocked(fetchLineups).mockResolvedValue(null);
  });

  it("renders the header wordmark and tab nav", async () => {
    render(<Home />);
    expect(await screen.findByText("Copa do Mundo")).toBeInTheDocument();
    expect(screen.getByText("Ao vivo")).toBeInTheDocument();
    expect(screen.getByText("Chaveamento")).toBeInTheDocument();
  });
});
