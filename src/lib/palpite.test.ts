import { describe, it, expect } from "vitest";
import {
  PALPITE_GRACE_MS,
  palpiteDeadline,
  isPalpiteOpen,
  formatCountdown,
} from "@/lib/palpite";

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
