// Watch-together protocol — the wire snapshot + the SHARED clock.
//
// Because a match is a pure function of (seed, wall-time) (the A0 keystone), a
// viewer reconstructs the identical live match from ~120 bytes of state + Date.now().
// viewerMinute is A0's minuteFrom re-anchored on a shared epoch (Date.now()/
// kickoffEpochMs) instead of the host's local performance.now(), so every viewer
// computes the same match minute (modulo a few seconds of device clock skew).
import { describe, it, expect } from "vitest";
import {
  serializeBroadcastState,
  parseBroadcastState,
  viewerMinute,
  createWatchHost,
  MIN_PER_MS,
  FULL_TIME,
  type BroadcastState,
} from "./watch-sync";

const base: BroadcastState = {
  v: 1,
  phase: "groups",
  seed: 2026,
  stageIdx: 1,
  kickoffEpochMs: 1_000_000,
  baseMin: 0,
  speed: 1,
  playing: true,
  spotlight: "g0-md1-s0",
  done: false,
  teamIds: null,
};

// A local copy of A0 minuteFrom to prove viewerMinute IS the same maths.
const minuteFrom = (baseMin: number, atMs: number, speed: number, now: number) =>
  Math.max(0, Math.min(FULL_TIME, baseMin + (now - atMs) * MIN_PER_MS * speed));

describe("watch-sync — wire format", () => {
  it("round-trips", () => {
    expect(parseBroadcastState(serializeBroadcastState(base))).toEqual(base);
  });

  it("rejects an unknown/absent protocol version", () => {
    expect(parseBroadcastState(JSON.stringify({ ...base, v: 2 }))).toBeNull();
    expect(parseBroadcastState(JSON.stringify({ ...base, v: undefined }))).toBeNull();
    expect(parseBroadcastState("not json")).toBeNull();
    expect(parseBroadcastState(JSON.stringify({ v: 1, phase: "nope" }))).toBeNull();
  });

  it("rejects bad field types but tolerates a null spotlight", () => {
    expect(parseBroadcastState(JSON.stringify({ ...base, seed: "x" }))).toBeNull();
    expect(parseBroadcastState(serializeBroadcastState({ ...base, spotlight: null }))).not.toBeNull();
  });

  it("carries the bracket-phase team ids and rejects a non-string array", () => {
    const withIds = { ...base, phase: "bracket" as const, teamIds: ["mt0", "mt5", "mt12"] };
    expect(parseBroadcastState(serializeBroadcastState(withIds))).toEqual(withIds);
    expect(parseBroadcastState(JSON.stringify({ ...base, teamIds: [1, 2] }))).toBeNull();
  });
});

describe("watch-sync — shared clock", () => {
  it("is A0's minuteFrom re-anchored on the shared epoch", () => {
    for (const speed of [1, 2, 4]) {
      for (const dMs of [0, 5000, 20000, 60000]) {
        const s = { ...base, speed };
        const now = base.kickoffEpochMs + dMs;
        expect(viewerMinute(s, now)).toBeCloseTo(minuteFrom(s.baseMin, s.kickoffEpochMs, speed, now), 9);
      }
    }
  });

  it("gives two viewers the same minute for the same wall-clock instant", () => {
    const now = base.kickoffEpochMs + 12_345;
    expect(viewerMinute(base, now)).toBe(viewerMinute({ ...base }, now));
  });

  it("freezes at baseMin while paused, and resumes continuously", () => {
    const paused = { ...base, playing: false, baseMin: 37.5 };
    expect(viewerMinute(paused, paused.kickoffEpochMs + 999999)).toBe(37.5); // frozen
    // resume re-anchors: fresh kickoff epoch, baseMin carried → continuous
    const resumed = { ...base, playing: true, baseMin: 37.5, kickoffEpochMs: 2_000_000 };
    expect(viewerMinute(resumed, 2_000_000)).toBe(37.5); // no jump at the instant of resume
    expect(viewerMinute(resumed, 2_000_000 + 6000)).toBeGreaterThan(37.5); // then advances
  });

  it("clamps to [0, 90]", () => {
    expect(viewerMinute(base, base.kickoffEpochMs - 5000)).toBe(0); // before kickoff
    expect(viewerMinute(base, base.kickoffEpochMs + 999_999_999)).toBe(FULL_TIME); // far future
  });

  it("maps device skew to a proportional minute offset (perceived gap = the skew itself)", () => {
    // The clock runs 1.5 match-min per real second at 1×, so the DISPLAYED-minute
    // offset between two devices = skew × MIN_PER_MS × speed. What a viewer actually
    // perceives is the real-time gap (= the skew). A well-synced (sub-second NTP)
    // clock keeps even the label offset under a match-minute — fine for a watch-along.
    const now = base.kickoffEpochMs + 30_000;
    for (const skewMs of [100, 500, 1000]) {
      const diff = Math.abs(viewerMinute(base, now) - viewerMinute(base, now + skewMs));
      expect(diff).toBeCloseTo(skewMs * MIN_PER_MS * base.speed, 9); // exact & proportional
    }
    expect(Math.abs(viewerMinute(base, now) - viewerMinute(base, now + 300))).toBeLessThan(0.5);
  });

  it("a join=seek state (baseMin seeded to now) produces a ~0 first tick", () => {
    // A late joiner anchors baseMin to the current minute and stamps kickoff=now,
    // so the first evaluated tick advances ~nothing (no spurious catch-up burst).
    const joinNow = 5_000_000;
    const seek = { ...base, baseMin: viewerMinute(base, joinNow), kickoffEpochMs: joinNow };
    expect(viewerMinute(seek, joinNow)).toBe(seek.baseMin);
  });
});

describe("watch-sync — host coalescer", () => {
  it("emits only when the serialized state changes; heartbeat re-emits", () => {
    const sent: BroadcastState[] = [];
    const host = createWatchHost((s) => sent.push(s));
    expect(host.push(base)).toBe(true); // first
    expect(host.push({ ...base })).toBe(false); // identical → suppressed
    expect(host.push({ ...base, stageIdx: 2 })).toBe(true); // a real transition
    expect(sent).toHaveLength(2);
    host.beat(); // re-emit last for late joiners (even if unchanged)
    expect(sent).toHaveLength(3);
    expect(sent[2].stageIdx).toBe(2);
  });

  it("beat() before any push does nothing", () => {
    const sent: BroadcastState[] = [];
    const host = createWatchHost((s) => sent.push(s));
    host.beat();
    expect(sent).toHaveLength(0);
  });
});
