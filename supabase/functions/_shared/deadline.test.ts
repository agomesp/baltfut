import { describe, it, expect } from "vitest";
import {
  matchTimingFromSummary,
  palpitesClosed,
  penWindowClosed,
  PALPITE_GRACE_MS,
} from "@shared/deadline";

const summary = (date?: string, state?: string, extra?: { name?: string; shortDetail?: string; displayClock?: string }) => ({
  header: {
    competitions: [{
      date,
      status: { displayClock: extra?.displayClock, type: { state, name: extra?.name, shortDetail: extra?.shortDetail } },
    }],
  },
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

describe("penWindowClosed (pen-winner vote cutoff)", () => {
  it("is OPEN during regulation and extra time (< 120')", () => {
    expect(penWindowClosed({ state: "in", clock: "62'" })).toBe(false);
    expect(penWindowClosed({ state: "in", clock: "90'+5'" })).toBe(false);
    expect(penWindowClosed({ state: "in", clock: "105'", detail: "STATUS_OVERTIME Overtime" })).toBe(false);
  });

  it("CLOSES once the shootout is signalled in the status text", () => {
    expect(penWindowClosed({ state: "in", detail: "STATUS_SHOOTOUT Penalty Shootout", clock: "120'" })).toBe(true);
    expect(penWindowClosed({ state: "in", detail: "Pens", clock: null })).toBe(true);
  });

  it("CLOSES at/after the end of extra time (≥120') as a fallback", () => {
    expect(penWindowClosed({ state: "in", clock: "120'" })).toBe(true);
    expect(penWindowClosed({ state: "in", clock: "120'+2'" })).toBe(true);
  });

  it("CLOSES once the match is finished", () => {
    expect(penWindowClosed({ state: "post", detail: "FT", clock: null })).toBe(true);
  });

  it("does not false-positive on 'open' (no \\bpen boundary) and stays open pre-match", () => {
    expect(penWindowClosed({ state: "pre", detail: "Scheduled", clock: null })).toBe(false);
    expect(penWindowClosed({ state: "in", detail: "match is open", clock: "70'" })).toBe(false);
  });

  it("matchTimingFromSummary surfaces detail + clock for the cutoff", () => {
    const t = matchTimingFromSummary(summary("2026-07-10T18:00Z", "in", { name: "STATUS_SHOOTOUT", shortDetail: "Pens", displayClock: "120'" }));
    expect(penWindowClosed(t)).toBe(true);
  });
});
