import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPromoDisplay,
  isPromoLocked,
  setPromoDisplay,
  togglePromoDisplay,
  applyPromoCommand,
  subscribePromoDisplay,
} from "@/lib/promo-display";

afterEach(() => setPromoDisplay(false, { lock: false }));

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

describe("promo-display lock + chat commands", () => {
  it("chat !promo shows promos; !palpites hides them when unlocked", () => {
    applyPromoCommand("promo");
    expect(isPromoDisplay()).toBe(true);
    applyPromoCommand("palpites");
    expect(isPromoDisplay()).toBe(false);
  });

  it("chat !promo never sets the lock", () => {
    applyPromoCommand("promo");
    expect(isPromoLocked()).toBe(false);
  });

  it("streamer lock blocks !palpites from reverting", () => {
    setPromoDisplay(true, { lock: true });
    expect(isPromoLocked()).toBe(true);
    applyPromoCommand("palpites");
    expect(isPromoDisplay()).toBe(true); // still on — chat can't revert
  });

  it("chat !promo while locked leaves the lock intact", () => {
    setPromoDisplay(true, { lock: true });
    applyPromoCommand("promo");
    expect(isPromoDisplay()).toBe(true);
    expect(isPromoLocked()).toBe(true);
  });

  it("streamer switching back to palpites clears the lock so chat can toggle again", () => {
    setPromoDisplay(true, { lock: true });
    setPromoDisplay(false, { lock: false });
    applyPromoCommand("promo");
    expect(isPromoDisplay()).toBe(true);
    applyPromoCommand("palpites");
    expect(isPromoDisplay()).toBe(false);
  });

  it("setPromoDisplay without opts leaves the lock unchanged", () => {
    setPromoDisplay(true, { lock: true });
    setPromoDisplay(false); // no opts
    expect(isPromoLocked()).toBe(true);
  });

  it("notifies subscribers when only the lock changes", () => {
    const fn = vi.fn();
    const unsub = subscribePromoDisplay(fn);
    setPromoDisplay(true, { lock: true }); // active + lock change
    setPromoDisplay(true, { lock: false }); // only lock changes
    expect(fn).toHaveBeenCalledTimes(2);
    unsub();
  });
});
