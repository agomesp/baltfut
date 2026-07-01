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

  it("ships the field as its own 'field' event and wires onField", () => {
    const { client, channel } = fakeSupabase();
    const ch = makeSupabaseChannel(client, "room-f");
    ch.broadcastField([{ id: "t1" }, { id: "t2" }]);
    expect(channel.send).toHaveBeenCalledWith({ type: "broadcast", event: "field", payload: { f: [{ id: "t1" }, { id: "t2" }] } });

    let got: unknown = null;
    ch.onField((f) => (got = f));
    channel.emit("broadcast", "field", { payload: { f: [{ id: "tX" }] } });
    expect(got).toEqual([{ id: "tX" }]);
  });
});

describe("watch-channel — BroadcastChannel late-join (real cross-instance)", () => {
  const tick = () => new Promise((r) => setTimeout(r, 15));

  it("re-sends the FIELD before the STATE to a late joiner (field must land first)", async () => {
    if (typeof BroadcastChannel === "undefined") return; // env without BC → covered by the guard test
    const room = "lj-" + Math.random().toString(36).slice(2);
    const host = createWatchChannel(room);
    host.broadcastField([{ id: "tA" }]);
    host.broadcast({ v: 1, seed: 42 });
    await tick();

    const order: string[] = [];
    let field: unknown = null;
    let state: unknown = null;
    const viewer = createWatchChannel(room); // its constructor pings want=true
    viewer.onField((f) => { field = f; order.push("field"); });
    viewer.onState((s) => { state = s; order.push("state"); });
    await tick();
    await tick();

    expect(field).toEqual([{ id: "tA" }]);
    expect(state).toEqual({ v: 1, seed: 42 });
    // the resync posts field then state, so a viewer never renders state without teams
    expect(order.indexOf("field")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("field")).toBeLessThan(order.indexOf("state"));
    host.close();
    viewer.close();
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
