import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPromoDisplay,
  setPromoDisplay,
  togglePromoDisplay,
  subscribePromoDisplay,
} from "@/lib/promo-display";

afterEach(() => setPromoDisplay(false));

describe("promo-display store", () => {
  it("defaults off and reflects set/toggle", () => {
    expect(isPromoDisplay()).toBe(false);
    setPromoDisplay(true);
    expect(isPromoDisplay()).toBe(true);
    togglePromoDisplay();
    expect(isPromoDisplay()).toBe(false);
  });

  it("notifies subscribers only on a real change", () => {
    const fn = vi.fn();
    const unsub = subscribePromoDisplay(fn);
    setPromoDisplay(true);
    setPromoDisplay(true); // no-op, same value
    togglePromoDisplay(); // -> false
    expect(fn).toHaveBeenCalledTimes(2);
    unsub();
    setPromoDisplay(true);
    expect(fn).toHaveBeenCalledTimes(2); // unsubscribed
  });
});
