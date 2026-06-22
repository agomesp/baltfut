import { describe, expect, it } from "vitest";
import { streamerClock } from "@/components/streamer-clock";

describe("streamerClock", () => {
  it("is empty when there is no live clock", () => {
    expect(streamerClock(null, 5)).toBe("");
    expect(streamerClock("", 5)).toBe("");
    expect(streamerClock("   ", 5)).toBe("");
  });

  it("ticks seconds within the reported minute", () => {
    expect(streamerClock("67'", 0)).toBe("67:00");
    expect(streamerClock("67'", 23)).toBe("67:23");
    expect(streamerClock("9'", 4)).toBe("9:04");
    expect(streamerClock("90'", 5)).toBe("90:05");
  });

  it("accepts a minute with no apostrophe", () => {
    expect(streamerClock("67", 23)).toBe("67:23");
  });

  it("holds at :59 until the next poll bumps the minute (never shows ahead)", () => {
    expect(streamerClock("67'", 75)).toBe("67:59");
    expect(streamerClock("67'", 600)).toBe("67:59");
  });

  it("guards against a negative elapsed", () => {
    expect(streamerClock("67'", -3)).toBe("67:00");
  });

  it("shows stoppage time and break labels verbatim (not tickable)", () => {
    expect(streamerClock("45'+2", 30)).toBe("45'+2");
    expect(streamerClock("90'+5'", 30)).toBe("90'+5'");
    expect(streamerClock("Intervalo", 10)).toBe("Intervalo");
    expect(streamerClock("HT", 10)).toBe("HT");
  });
});
