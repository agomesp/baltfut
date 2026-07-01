// Watch-together transport — a dumb pipe over an opaque payload. The presence
// logic is pure-tested; the Supabase impl is tested against a fake reactions-shaped
// channel; the BroadcastChannel/SSR paths are guard-tested (no throw).
import { describe, it, expect, vi } from "vitest";
import { createPresenceTracker, makeSupabaseChannel, createWatchChannel, STALE_MS } from "./watch-channel";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("watch-channel — presence tracker (pure)", () => {
  it("counts live peers + self, ages out the stale, drops on bye", () => {
    let now = 0;
    const t = createPresenceTracker(() => now);
    t.mark("a");
    t.mark("b");
    expect(t.count()).toBe(3); // a + b + self
    now += STALE_MS + 1; // both go stale without a refresh
    expect(t.count()).toBe(1); // just self
    now = 0;
    t.mark("a");
    t.mark("b");
    t.bye("a");
    expect(t.count()).toBe(2); // b + self
  });
});

describe("watch-channel — Supabase impl (fake channel)", () => {
  function fakeSupabase() {
    const handlers: Record<string, (p: unknown) => void> = {};
    const removeChannel = vi.fn();
    const channel = {
      on(type: string, filter: { event: string }, cb: (p: unknown) => void) {
        handlers[`${type}:${filter.event}`] = cb;
        return channel;
      },
      subscribe(cb?: (s: string) => void) {
        cb?.("SUBSCRIBED");
        return channel;
      },
      send: vi.fn(),
      track: vi.fn(),
      presenceState: () => ({ p1: [{}], p2: [{}] }), // 2 present
      emit(type: string, event: string, payload: unknown) {
        handlers[`${type}:${event}`]?.(payload);
      },
    };
    const client = { channel: () => channel, removeChannel } as unknown as SupabaseClient;
    return { client, channel, removeChannel };
  }

  it("broadcasts as a 'state' event, maps native presence, wires onState, removes on close", () => {
    const { client, channel, removeChannel } = fakeSupabase();
    const ch = makeSupabaseChannel(client, "room1");
    expect(channel.track).toHaveBeenCalled(); // tracked its own presence on subscribe

    ch.broadcast({ v: 1, seed: 7 });
    expect(channel.send).toHaveBeenCalledWith({ type: "broadcast", event: "state", payload: { s: { v: 1, seed: 7 } } });

    let count = -1;
    ch.onPresence((n) => (count = n));
    channel.emit("presence", "sync", {});
    expect(count).toBe(2); // presenceState key count

    let got: unknown = null;
    ch.onState((s) => (got = s));
    channel.emit("broadcast", "state", { payload: { s: { hi: 1 } } });
    expect(got).toEqual({ hi: 1 });

    ch.close();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});

describe("watch-channel — factory guards", () => {
  it("returns a channel whose methods never throw (SSR / no-transport safe)", () => {
    // In jsdom (no configured Supabase) the factory falls to BroadcastChannel or a
    // no-op; either way every method + close must be safe to call.
    const ch = createWatchChannel("room-x");
    expect(() => {
      ch.onState(() => {});
      ch.onPresence(() => {});
      ch.broadcast({ v: 1 });
      ch.setPresent();
      ch.close();
    }).not.toThrow();
  });
});
