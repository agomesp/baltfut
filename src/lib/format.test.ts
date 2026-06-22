import { describe, it, expect } from "vitest";
import { dayKey, fmtTime, groupByDay, scoreText } from "@/lib/format";
import type { Match } from "@/lib/espn";

const m = (id: string, startsAt: string, hs: number | null = null, as: number | null = null): Match => ({
  id,
  league: "fifa.world",
  name: id,
  shortName: id,
  startsAt,
  state: hs == null ? "pre" : "post",
  isLive: false,
  statusDetail: "",
  displayClock: null,
  venue: null,
  home: { id: "h", name: "H", abbreviation: "H", logo: null },
  away: { id: "a", name: "A", abbreviation: "A", logo: null },
  homeScore: hs,
  awayScore: as,
  goals: [],
  cards: [],
});

describe("dayKey", () => {
  it("returns a stable date key in the given timezone", () => {
    expect(dayKey("2026-06-21T23:00Z", "UTC")).toBe("2026-06-21");
    expect(dayKey("2026-06-21T23:00Z", "America/Sao_Paulo")).toBe("2026-06-21");
    expect(dayKey("nope", "UTC")).toBe("");
  });
});

describe("fmtTime", () => {
  it("formats 24h time in a given timezone", () => {
    expect(fmtTime("2026-06-21T16:00Z", "UTC")).toBe("16:00");
  });
});

describe("groupByDay", () => {
  it("groups matches by UTC day, preserving order", () => {
    const groups = groupByDay(
      [
        m("a", "2026-06-21T16:00Z"),
        m("b", "2026-06-21T19:00Z"),
        m("c", "2026-06-22T16:00Z"),
      ],
      "UTC",
    );
    expect(groups.map((g) => g.key)).toEqual(["2026-06-21", "2026-06-22"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("scoreText", () => {
  it("renders a score only when present", () => {
    expect(scoreText(m("a", "2026-06-21T16:00Z", 2, 1))).toBe("2 – 1");
    expect(scoreText(m("b", "2026-06-21T16:00Z"))).toBe("");
  });
});
