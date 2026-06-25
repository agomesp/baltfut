import { describe, it, expect, beforeEach } from "vitest";
import { isStreamerMode, setStreamerMode, subscribeStreamerMode } from "@/lib/streamer-mode";

describe("streamer-mode store", () => {
  beforeEach(() => setStreamerMode(false));

  it("defaults to off", () => {
    expect(isStreamerMode()).toBe(false);
  });

  it("reflects the latest set value", () => {
    setStreamerMode(true);
    expect(isStreamerMode()).toBe(true);
    setStreamerMode(false);
    expect(isStreamerMode()).toBe(false);
  });

  it("notifies subscribers on change and stops after unsubscribe", () => {
    const seen: boolean[] = [];
    const unsub = subscribeStreamerMode(() => seen.push(isStreamerMode()));
    setStreamerMode(true);
    setStreamerMode(false);
    unsub();
    setStreamerMode(true); // after unsub — must not be seen
    expect(seen).toEqual([true, false]);
  });

  it("does not notify when the value is unchanged", () => {
    setStreamerMode(true);
    let count = 0;
    const unsub = subscribeStreamerMode(() => count++);
    setStreamerMode(true); // no-op, same value
    unsub();
    expect(count).toBe(0);
  });
});
