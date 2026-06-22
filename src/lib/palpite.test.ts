import { describe, it, expect } from "vitest";
import {
  PALPITE_GRACE_MS,
  palpiteDeadline,
  isPalpiteOpen,
  formatCountdown,
  formatCountdownLong,
  releasedMatchIds,
} from "@/lib/palpite";
import type { Match } from "@/lib/espn";

const KICK = "2026-06-21T16:00:00Z";
const kickMs = Date.parse(KICK);

describe("palpiteDeadline", () => {
  it("is kickoff + 5 minutes", () => {
    expect(palpiteDeadline(KICK)).toBe(kickMs + PALPITE_GRACE_MS);
  });
  it("is NaN for an unparseable date", () => {
    expect(Number.isNaN(palpiteDeadline("nope"))).toBe(true);
  });
});

describe("isPalpiteOpen", () => {
  const deadline = palpiteDeadline(KICK);
  it("open before the deadline (incl. first 5 live minutes)", () => {
    expect(isPalpiteOpen(deadline, kickMs - 1000)).toBe(true); // pre-kickoff
    expect(isPalpiteOpen(deadline, kickMs + 4 * 60_000)).toBe(true); // 4' in
  });
  it("closed at/after the deadline", () => {
    expect(isPalpiteOpen(deadline, kickMs + 5 * 60_000)).toBe(false);
    expect(isPalpiteOpen(deadline, kickMs + 60 * 60_000)).toBe(false);
  });
  it("closed when the deadline is unknown (NaN)", () => {
    expect(isPalpiteOpen(NaN, kickMs)).toBe(false);
  });
});

describe("formatCountdown", () => {
  it("formats remaining ms as M:SS (minutes may exceed 59)", () => {
    expect(formatCountdown(40 * 60_000 + 13_000)).toBe("40:13");
    expect(formatCountdown(9_000)).toBe("0:09");
    expect(formatCountdown(-5_000)).toBe("0:00");
  });
});

describe("formatCountdownLong", () => {
  it("uses H:MM:SS past an hour, else M:SS", () => {
    expect(formatCountdownLong(2 * 3600_000 + 5 * 60_000 + 9_000)).toBe("2:05:09");
    expect(formatCountdownLong(7 * 60_000 + 3_000)).toBe("7:03");
    expect(formatCountdownLong(-1)).toBe("0:00");
  });
});

describe("releasedMatchIds", () => {
  const m = (id: string, state: Match["state"], startsAt: string): Match => ({
    id, league: "fifa.world", name: id, shortName: id, startsAt, state,
    isLive: state === "in", statusDetail: "", displayClock: null, venue: null,
    home: { id: "h", name: "H", abbreviation: "H", logo: null },
    away: { id: "a", name: "A", abbreviation: "A", logo: null },
    homeScore: null, awayScore: null, goals: [], cards: [],
  });

  it("releases the current + next kickoff-hour group, grouping same-hour matches", () => {
    const matches = [
      m("a", "post", "2026-06-21T16:00Z"),
      m("b", "post", "2026-06-21T16:00Z"),
      m("c", "in", "2026-06-21T19:00Z"),
      m("d", "pre", "2026-06-21T19:00Z"),
      m("e", "pre", "2026-06-21T22:00Z"),
      m("f", "pre", "2026-06-21T22:00Z"),
      m("g", "pre", "2026-06-22T01:00Z"),
    ];
    const released = releasedMatchIds(matches);
    // current group = 19:00 (live); next = 22:00 (both same-hour). 01:00 locked.
    expect(released.has("c")).toBe(true);
    expect(released.has("d")).toBe(true);
    expect(released.has("e")).toBe(true);
    expect(released.has("f")).toBe(true);
    expect(released.has("g")).toBe(false); // beyond next -> locked
    // finished earlier group stays released (shows winners, not locked)
    expect(released.has("a")).toBe(true);
  });
});
