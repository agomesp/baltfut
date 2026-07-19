import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { Match } from "@/lib/espn";
import { ChampionsGate } from "@/components/champions/champions-gate";

/**
 * When the ceremony takes over.
 *
 * After the whistle the ceremony IS the site's front page: someone arriving an
 * hour later came to see who won, not the fixture list. It also has to open on
 * the transition, for everyone already watching when the final ends. What it must
 * NOT do is reopen after being dismissed, or the back button would be a no-op.
 */

function match(id: string, stage: string, state: Match["state"], hs: number | null, as: number | null): Match {
  return {
    id, league: "fifa.world", name: id, shortName: id, startsAt: "2026-07-19T19:00:00Z", state,
    isLive: state === "in", statusDetail: "", displayClock: null, venue: null,
    stage,
    home: { id: "h", name: "Espanha", abbreviation: "ESP", logo: null },
    away: { id: "a", name: "Argentina", abbreviation: "ARG", logo: null },
    homeScore: hs, awayScore: as,
    homeShootout: null, awayShootout: null,
    goals: [], cards: [],
  } as Match;
}

const FINISHED = [match("f", "final", "post", 2, 1)];
const PENDING = [match("f", "final", "pre", null, null)];

function setup(matches: Match[]) {
  const onOpen = vi.fn();
  const view = render(
    <ChampionsGate matches={matches} allEntries={[]} open={false} onOpen={onOpen} onClose={() => {}} />,
  );
  return { onOpen, view };
}

describe("ChampionsGate auto-open", () => {
  it("opens on a fresh load when the final is ALREADY finished", () => {
    const { onOpen } = setup(FINISHED);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("stays shut while the final is still pending", () => {
    const { onOpen } = setup(PENDING);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("opens when the final crosses into finished mid-session", () => {
    const { onOpen, view } = setup(PENDING);
    expect(onOpen).not.toHaveBeenCalled();
    view.rerender(
      <ChampionsGate matches={FINISHED} allEntries={[]} open={false} onOpen={onOpen} onClose={() => {}} />,
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("does not reopen once dismissed — the back button has to stick", () => {
    const { onOpen, view } = setup(FINISHED);
    expect(onOpen).toHaveBeenCalledTimes(1);
    // Data keeps refreshing behind the closed overlay; that must not re-trigger.
    view.rerender(
      <ChampionsGate matches={[...FINISHED]} allEntries={[]} open={false} onOpen={onOpen} onClose={() => {}} />,
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
