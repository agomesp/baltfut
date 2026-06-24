import { describe, expect, it } from "vitest";
import type { Match } from "@/lib/espn";
import { decideConcurrent, concurrentPartner, LEAD_MS } from "@/lib/concurrent-games";

const T0 = Date.parse("2026-06-24T19:00:00Z");
const MIN = 60_000;

function mk(id: string, offsetMin: number, state: Match["state"]): Match {
  return {
    id,
    league: "fifa.world",
    name: id,
    shortName: id,
    startsAt: new Date(T0 + offsetMin * MIN).toISOString(),
    state,
    isLive: state === "in",
    statusDetail: "",
    displayClock: null,
    venue: null,
    home: { id: `${id}h`, name: `${id}H`, abbreviation: `${id}H`, logo: null },
    away: { id: `${id}a`, name: `${id}A`, abbreviation: `${id}A`, logo: null },
    homeScore: state === "pre" ? null : 0,
    awayScore: state === "pre" ? null : 0,
    goals: [],
    cards: [],
  };
}

describe("decideConcurrent", () => {
  it("shows one game when nothing else overlaps", () => {
    const a = mk("a", 0, "pre");
    const far = mk("far", 300, "pre"); // 5h later — no overlap
    expect(decideConcurrent(a, [a, far], T0 - 60 * MIN)).toEqual({ primary: a, partner: null });
  });

  it("pairs two simultaneous pre-match games anytime before kickoff", () => {
    const a = mk("a", 0, "pre");
    const b = mk("b", 0, "pre");
    const d = decideConcurrent(a, [a, b], T0 - 5 * 60 * MIN); // 5h early
    expect(d.partner).toBe(b);
  });

  it("pairs two simultaneous live games", () => {
    const a = mk("a", 0, "in");
    const b = mk("b", 0, "in");
    expect(decideConcurrent(a, [a, b], T0 + 30 * MIN).partner).toBe(b);
  });

  it("drops back to the remaining game when the selected one finishes", () => {
    const a = mk("a", 0, "post"); // finished
    const b = mk("b", 0, "in"); // still live
    expect(decideConcurrent(a, [a, b], T0 + 100 * MIN)).toEqual({ primary: b, partner: null });
  });

  describe("staggered overlap (b starts 60 min into a)", () => {
    const a = mk("a", 0, "in");
    const b = mk("b", 60, "pre");

    it("shows one game before 10 min ahead of the later kickoff", () => {
      const d = decideConcurrent(a, [a, b], T0 + 45 * MIN); // 15 min before b
      expect(d.partner).toBeNull();
      expect(d.primary).toBe(a);
    });

    it("opens the pair 10 min before the later kickoff", () => {
      const d = decideConcurrent(a, [a, b], T0 + 60 * MIN - LEAD_MS);
      expect(d.partner).toBe(b);
    });
  });

  it("concurrentPartner ignores finished games and picks the closest kickoff", () => {
    const a = mk("a", 0, "in");
    const sim = mk("sim", 0, "in"); // simultaneous
    const stag = mk("stag", 60, "pre"); // overlapping but later
    const done = mk("done", 0, "post"); // simultaneous but finished
    expect(concurrentPartner(a, [a, sim, stag, done])).toBe(sim);
  });
});
