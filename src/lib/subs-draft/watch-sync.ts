// Watch-together protocol + shared clock (pure — no React/DOM).
//
// The A0 keystone makes a whole mock Copa a pure function of (seed, wall-time), so
// a viewer reconstructs the identical live match from this tiny snapshot + the wall
// clock. NOTHING else (goals, scorelines, standings, positions) is ever sent — it
// is all re-derived locally. This module owns the wire format + the shared-clock
// minute; the view-level replay (drawGroups/buildBracket with the real teams) lives
// in the viewer component, using the same deterministic helpers as the host.
import { FULL_TIME } from "./tournament";
import { SECS_PER_MATCH } from "./sim-timing";

export { FULL_TIME };
export const MIN_PER_MS = FULL_TIME / (SECS_PER_MATCH * 1000);

/** The broadcast snapshot (~120 bytes). `seed` is the keystone: it replaces
 * streaming the draw and every scoreline. `kickoffEpochMs` is a SHARED Date.now()
 * anchor (comparable across devices), unlike the host's local performance.now(). */
export interface BroadcastState {
  v: 1;
  phase: "groups" | "bracket";
  seed: number;
  stageIdx: number; // groups matchday 0..2 / bracket round 0..4
  kickoffEpochMs: number; // Date.now() when this stage's clock was (re)anchored
  baseMin: number; // minute at kickoffEpochMs (0 fresh; frozen minute on pause)
  speed: number;
  playing: boolean;
  spotlight: string | null;
  done: boolean;
  /** The exact field for the BRACKET phase (its 32 team ids in draw order) — the
   * knockout's teams differ per Copa (the qualified 32). null in groups, where the
   * viewer rebuilds all 48 from fillTo48([]). All ids are `mt<n>` ⊂ fillTo48([]). */
  teamIds: string[] | null;
}

const clamp90 = (v: number) => Math.max(0, Math.min(FULL_TIME, v));

/**
 * The match minute a viewer should show — A0's minuteFrom, re-anchored on the
 * SHARED epoch. Same maths as the host's solo clock; the only change is the
 * timebase (Date.now() vs the host's local performance.now()).
 */
export function viewerMinute(s: BroadcastState, nowEpochMs: number): number {
  if (!s.playing) return clamp90(s.baseMin);
  return clamp90(s.baseMin + (nowEpochMs - s.kickoffEpochMs) * MIN_PER_MS * s.speed);
}

export function serializeBroadcastState(s: BroadcastState): string {
  return JSON.stringify(s);
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Parse + validate a wire snapshot; returns null on anything unexpected (unknown
 * version, bad shape/types) so a viewer never acts on a malformed/foreign message. */
export function parseBroadcastState(raw: string): BroadcastState | null {
  try {
    return validateBroadcastState(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Validate an already-parsed object (the transport ships objects, not strings). */
export function validateBroadcastState(o: unknown): BroadcastState | null {
  if (typeof o !== "object" || o === null) return null;
  const s = o as Record<string, unknown>;
  if (s.v !== 1) return null;
  if (s.phase !== "groups" && s.phase !== "bracket") return null;
  if (!isNum(s.seed) || !isNum(s.stageIdx) || !isNum(s.kickoffEpochMs) || !isNum(s.baseMin) || !isNum(s.speed)) return null;
  if (typeof s.playing !== "boolean" || typeof s.done !== "boolean") return null;
  if (s.spotlight !== null && typeof s.spotlight !== "string") return null;
  if (s.teamIds !== null && !(Array.isArray(s.teamIds) && s.teamIds.every((x) => typeof x === "string"))) return null;
  return {
    v: 1,
    phase: s.phase,
    seed: s.seed,
    stageIdx: s.stageIdx,
    kickoffEpochMs: s.kickoffEpochMs,
    baseMin: s.baseMin,
    speed: s.speed,
    playing: s.playing,
    spotlight: s.spotlight,
    done: s.done,
    teamIds: s.teamIds as string[] | null,
  };
}

export interface WatchHost {
  /** Emit only if the state changed since the last emit. Returns whether it emitted. */
  push(state: BroadcastState): boolean;
  /** Re-emit the last state (for late joiners / dropped-message recovery). */
  beat(): void;
}

/**
 * Host-side coalescer: the host loop ticks often but the wire should only carry
 * TRANSITIONS (play/pause, speed, stage advance, spotlight, done) — the viewer
 * derives the minute itself from the anchor + clock. Emits on a changed serialized
 * state; a periodic beat() re-emits the last so a mid-match joiner resyncs.
 */
export function createWatchHost(emit: (state: BroadcastState) => void): WatchHost {
  let last = "";
  let lastState: BroadcastState | null = null;
  return {
    push(state: BroadcastState): boolean {
      const s = serializeBroadcastState(state);
      if (s === last) return false;
      last = s;
      lastState = state;
      emit(state);
      return true;
    },
    beat() {
      if (lastState) emit(lastState);
    },
  };
}
