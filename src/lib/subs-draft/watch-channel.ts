// Watch-together transport — one interface, two implementations, so a room works
// cross-TAB with zero config now and cross-DEVICE when Supabase is configured. It
// is a DUMB PIPE: it ships an opaque payload and never inspects it (the wire format
// lives in watch-sync.ts). Broadcast + presence only — NO database, NO RLS, NO
// writes; ephemeral pub/sub, exactly like the reactions channel.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

export const PING_MS = 2000;
export const STALE_MS = 6000;

export interface WatchChannel {
  broadcast(state: unknown): void;
  /** Ship the ROOM FIELD — the ordered Team[] a drafted room needs (rebuilt from real
   * rosters, not fillTo48). Separate from the per-tick state (it's ~35KB, sent rarely):
   * the host re-emits it on its beat + on late-join so a viewer eventually has it. */
  broadcastField(field: unknown): void;
  onState(cb: (state: unknown) => void): void;
  onField(cb: (field: unknown) => void): void;
  onPresence(cb: (count: number) => void): void;
  setPresent(): void;
  close(): void;
}

const genId = () => Math.random().toString(36).slice(2, 10);
const roomName = (id: string) => `subs-watch:${id}`;

/* ── presence (pure, testable) ───────────────────────────────────────────────
 * BroadcastChannel has no native presence, so peers heartbeat their id and we
 * count distinct ids seen within STALE_MS, plus self. */
export function createPresenceTracker(nowFn: () => number = () => Date.now(), staleMs: number = STALE_MS) {
  const peers = new Map<string, number>();
  return {
    mark(id: string) { peers.set(id, nowFn()); },
    bye(id: string) { peers.delete(id); },
    count(): number {
      const t = nowFn();
      for (const [id, ts] of peers) if (t - ts > staleMs) peers.delete(id);
      return peers.size + 1; // + self
    },
  };
}

/* ── Supabase Realtime impl (cross-device) — mirrors reactions.tsx ──────────── */
export function makeSupabaseChannel(client: SupabaseClient, id: string): WatchChannel {
  const selfId = genId();
  let stateCb: ((s: unknown) => void) | null = null;
  let fieldCb: ((f: unknown) => void) | null = null;
  let presenceCb: ((n: number) => void) | null = null;
  const channel = client.channel(roomName(id), { config: { presence: { key: selfId } } });
  channel
    .on("broadcast", { event: "state" }, (msg: { payload?: { s?: unknown } }) => stateCb?.(msg.payload?.s))
    .on("broadcast", { event: "field" }, (msg: { payload?: { f?: unknown } }) => fieldCb?.(msg.payload?.f))
    .on("presence", { event: "sync" }, () => presenceCb?.(Object.keys(channel.presenceState()).length))
    .subscribe((status: string) => { if (status === "SUBSCRIBED") void channel.track({ id: selfId }); });
  return {
    broadcast(state) { void channel.send({ type: "broadcast", event: "state", payload: { s: state } }); },
    broadcastField(field) { void channel.send({ type: "broadcast", event: "field", payload: { f: field } }); },
    onState(cb) { stateCb = cb; },
    onField(cb) { fieldCb = cb; },
    onPresence(cb) { presenceCb = cb; },
    setPresent() { /* presence is tracked on subscribe */ },
    close() { void client.removeChannel(channel); },
  };
}

/* ── BroadcastChannel impl (cross-tab, zero backend) ─────────────────────────── */
type Wire = { k: "state" | "field" | "ping" | "bye"; from: string; s?: unknown; f?: unknown; want?: boolean };

function makeBroadcastChannel(id: string): WatchChannel {
  const selfId = genId();
  const bc = new BroadcastChannel(roomName(id));
  const tracker = createPresenceTracker();
  let stateCb: ((s: unknown) => void) | null = null;
  let fieldCb: ((f: unknown) => void) | null = null;
  let presenceCb: ((n: number) => void) | null = null;
  let lastState: unknown = null;
  let lastField: unknown = null;
  const emitPresence = () => presenceCb?.(tracker.count());
  const ping = (want = false) => bc.postMessage({ k: "ping", from: selfId, want } satisfies Wire);

  bc.onmessage = (e: MessageEvent<Wire>) => {
    const m = e.data;
    if (!m || typeof m !== "object") return;
    if (m.k === "state") { lastState = m.s; stateCb?.(m.s); }
    else if (m.k === "field") { lastField = m.f; fieldCb?.(m.f); }
    else if (m.k === "ping") {
      tracker.mark(m.from);
      emitPresence();
      // late-join resync: send the FIELD first so the viewer has teams before the state
      // it needs them for (a state-without-field would replay the wrong/absent roster).
      if (m.want && lastField != null) bc.postMessage({ k: "field", from: selfId, f: lastField } satisfies Wire);
      if (m.want && lastState != null) bc.postMessage({ k: "state", from: selfId, s: lastState } satisfies Wire);
    } else if (m.k === "bye") { tracker.bye(m.from); emitPresence(); }
  };
  const timer = setInterval(() => { ping(); emitPresence(); }, PING_MS);
  ping(true); // announce + request the current state

  return {
    broadcast(state) { lastState = state; bc.postMessage({ k: "state", from: selfId, s: state } satisfies Wire); },
    broadcastField(field) { lastField = field; bc.postMessage({ k: "field", from: selfId, f: field } satisfies Wire); },
    onState(cb) { stateCb = cb; },
    onField(cb) { fieldCb = cb; },
    onPresence(cb) { presenceCb = cb; emitPresence(); },
    setPresent() { ping(); },
    close() {
      clearInterval(timer);
      try { bc.postMessage({ k: "bye", from: selfId } satisfies Wire); } catch { /* closing */ }
      bc.close();
    },
  };
}

const noopChannel = (): WatchChannel => ({
  broadcast() {}, broadcastField() {}, onState() {}, onField() {}, onPresence() {}, setPresent() {}, close() {},
});

/**
 * Pick the transport: Supabase Realtime when configured (cross-device), else
 * BroadcastChannel (cross-tab, zero backend), else a no-op (SSR / static export).
 */
export function createWatchChannel(id: string): WatchChannel {
  if (isSupabaseConfigured()) {
    const client = getSupabaseClient();
    if (client) return makeSupabaseChannel(client, id);
  }
  if (typeof BroadcastChannel === "undefined") return noopChannel();
  return makeBroadcastChannel(id);
}
