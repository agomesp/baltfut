import { describe, it, expect } from "vitest";
import {
  matchTimingFromSummary,
  palpitesClosed,
  PALPITE_GRACE_MS,
} from "@shared/deadline";

const summary = (date?: string, state?: string) => ({
  header: { competitions: [{ date, status: { type: { state } } }] },
});

describe("matchTimingFromSummary", () => {
  it("extracts kickoff ms and state", () => {
    const t = matchTimingFromSummary(summary("2026-06-21T04:00Z", "post"));
    expect(t.kickoffMs).toBe(Date.parse("2026-06-21T04:00Z"));
    expect(t.state).toBe("post");
  });

  it("returns NaN kickoff and null state when absent", () => {
    const t = matchTimingFromSummary({});
    expect(Number.isNaN(t.kickoffMs)).toBe(true);
    expect(t.state).toBeNull();
  });
});

describe("palpitesClosed", () => {
  const k = Date.parse("2026-06-21T04:00Z");

  it("is closed for a finished match regardless of clock", () => {
    expect(palpitesClosed({ kickoffMs: k, state: "post" }, k - 10_000)).toBe(true);
  });

  it("is open before kickoff + grace", () => {
    expect(palpitesClosed({ kickoffMs: k, state: "pre" }, k + PALPITE_GRACE_MS - 1_000)).toBe(false);
  });

  it("is closed after kickoff + grace", () => {
    expect(palpitesClosed({ kickoffMs: k, state: "in" }, k + PALPITE_GRACE_MS + 1_000)).toBe(true);
  });

  it("fails open when kickoff is unknown and not finished", () => {
    expect(palpitesClosed({ kickoffMs: Number.NaN, state: null }, k)).toBe(false);
  });
});
