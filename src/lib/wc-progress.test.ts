import { describe, expect, it } from "vitest";
import { wcProgress, WC_START_MS, WC_END_MS } from "@/lib/wc-progress";

describe("wcProgress", () => {
  it("is 0% at (or before) the opening match", () => {
    expect(wcProgress(WC_START_MS).pct).toBe(0);
    expect(wcProgress(WC_START_MS - 10_000_000).ratio).toBe(0);
  });

  it("is 100% at (or after) the final", () => {
    expect(wcProgress(WC_END_MS).pct).toBe(100);
    expect(wcProgress(WC_END_MS + 10_000_000).ratio).toBe(1);
  });

  it("is ~50% at the midpoint", () => {
    const mid = WC_START_MS + (WC_END_MS - WC_START_MS) / 2;
    expect(wcProgress(mid).pct).toBe(50);
  });
});
