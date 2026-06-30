import { describe, it, expect } from "vitest";
import {
  matchTimingFromSummary,
  palpitesClosed,
  palpitesClosedWithOverride,
  penWindowClosed,
  penWindowHardClosed,
  penVoteVisible,
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

describe("palpitesClosedWithOverride (manual per-match open window)", () => {
  const k = Date.parse("2026-06-21T04:00Z");

  it("falls back to the default rule when no override is set", () => {
    expect(palpitesClosedWithOverride({ kickoffMs: k, state: "in" }, k + PALPITE_GRACE_MS + 1_000, null)).toBe(true);
    expect(palpitesClosedWithOverride({ kickoffMs: k, state: "pre" }, k + 1_000, { openUntil: null })).toBe(false);
  });

  it("EXTENDS the window: open well past the default grace while now <= openUntil", () => {
    const openUntil = k + 30 * 60_000; // 30 min after kickoff
    expect(palpitesClosedWithOverride({ kickoffMs: k, state: "in" }, k + 20 * 60_000, { openUntil })).toBe(false);
    expect(palpitesClosedWithOverride({ kickoffMs: k, state: "in" }, openUntil + 1_000, { openUntil })).toBe(true);
  });

  it("REOPENS a finished match while now <= openUntil (overrides the post state)", () => {
    const openUntil = k + 3 * 3_600_000;
    expect(palpitesClosedWithOverride({ kickoffMs: k, state: "post" }, openUntil - 1_000, { openUntil })).toBe(false);
  });

  it("CLOSES early when openUntil is in the past (overrides the open grace)", () => {
    expect(palpitesClosedWithOverride({ kickoffMs: k, state: "pre" }, k - 1_000, { openUntil: k - 60_000 })).toBe(true);
  });

  it("ignores a non-finite openUntil and uses the default rule", () => {
    expect(palpitesClosedWithOverride({ kickoffMs: k, state: "pre" }, k + 1_000, { openUntil: Number.NaN })).toBe(false);
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

  it("penWindowHardClosed: only post / shootout-signal (NOT the 120' clock)", () => {
    expect(penWindowHardClosed({ state: "post", detail: "FT" })).toBe(true);
    expect(penWindowHardClosed({ state: "in", detail: "STATUS_SHOOTOUT Pens" })).toBe(true);
    expect(penWindowHardClosed({ state: "in", detail: "STATUS_OVERTIME 120'" })).toBe(false); // clock alone doesn't hard-close
    expect(penWindowHardClosed({ state: "in", detail: "ET" })).toBe(false);
  });

  it("matchTimingFromSummary surfaces detail + clock for the cutoff", () => {
    const t = matchTimingFromSummary(summary("2026-07-10T18:00Z", "in", { name: "STATUS_SHOOTOUT", shortDetail: "Pens", displayClock: "120'" }));
    expect(penWindowClosed(t)).toBe(true);
  });
});

describe("penVoteVisible (pen UI appears 10 min before the shootout, at 110')", () => {
  it("is HIDDEN pre-match and through regulation / early extra time (< 110')", () => {
    expect(penVoteVisible({ state: "pre", clock: null })).toBe(false);
    expect(penVoteVisible({ state: "in", clock: "75'" })).toBe(false);
    expect(penVoteVisible({ state: "in", clock: "90'+5'" })).toBe(false);
    expect(penVoteVisible({ state: "in", clock: "109'" })).toBe(false);
  });

  it("auto-SHOWS from 110' (10 min before pens) through extra time", () => {
    expect(penVoteVisible({ state: "in", clock: "110'" })).toBe(true);
    expect(penVoteVisible({ state: "in", clock: "118'" })).toBe(true);
    expect(penVoteVisible({ state: "in", clock: "120'+2'" })).toBe(true);
  });

  it("stays visible once the shootout / full-time is signalled (to show the result)", () => {
    expect(penVoteVisible({ state: "in", detail: "Pens", clock: null })).toBe(true);
    expect(penVoteVisible({ state: "post", clock: null })).toBe(true);
  });
});
