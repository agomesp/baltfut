// A0.2 — fixed-timestep accumulator + cosmetic render interpolation.
//
// A0.1 made the sim a pure function of its seed; this makes it a pure function
// of its seed AND its step COUNT, independent of frame rate. `advance(nowMs)`
// reads the wall clock only to decide HOW MANY fixed steps to run — every step
// receives the constant FIXED_DT, so wall time never leaks into the sim's maths.
// That keeps the authority plane deterministic (two viewers, any frame rate,
// same seed → identical match) while the render plane interpolates for smoothness.
//
// The same `advance()` is safe to call from BOTH the rAF render loop and the
// background worker metronome (A0.3): it steps by elapsed wall time, so whichever
// pump fires first consumes the elapsed and the other runs ~0 steps — no
// double-stepping. A long hidden-tab freeze is bounded by MAX_CATCHUP so resume
// catches up in one small burst instead of a spiral of thousands of steps.
import type { Snapshot } from "./match-sim";

/** Authority tick — 60 Hz. The sim was tuned at ~16ms variable dt and clamps
 * dt≤0.05 internally, so this sits comfortably inside its stable range. */
export const FIXED_DT = 1 / 60;
/** Most simulated time a single `advance` will consume — caps the resume hitch
 * after the tab was hidden (motion catches up; the match MINUTE is re-derived
 * independently from the tournament wall-clock anchor, so it stays correct). */
export const MAX_CATCHUP = 0.25;
/** Hard ceiling on steps per advance (spiral-of-death guard). */
export const MAX_STEPS = Math.ceil(MAX_CATCHUP / FIXED_DT);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface SimClock {
  /** Advance the sim by the wall time elapsed since the last call, in fixed
   * FIXED_DT steps. Returns how many steps ran (0 on the first call / no time). */
  advance(nowMs: number): number;
  /** Leftover accumulator as a 0..1 fraction of a step — the render interpolation
   * factor between the previous and current authoritative snapshots. */
  alpha(): number;
  /** True when the last advance hit MAX_CATCHUP (a real freeze happened) — the
   * caller should resync to current state rather than replay batched events. */
  wasCapped(): boolean;
  /** Re-base the timebase to `nowMs` and clear the accumulator (e.g. on restart). */
  reset(nowMs: number): void;
}

/**
 * @param step called once per fixed tick with the constant FIXED_DT (seconds).
 */
export function createSimClock(step: (dt: number) => void): SimClock {
  let lastMs: number | null = null;
  let acc = 0;
  let capped = false;

  return {
    advance(nowMs: number): number {
      if (lastMs === null) {
        lastMs = nowMs; // first call just anchors the timebase
        return 0;
      }
      let elapsed = (nowMs - lastMs) / 1000; // ms → seconds
      lastMs = nowMs;
      if (elapsed < 0) elapsed = 0; // clock skew / non-monotonic guard
      capped = elapsed > MAX_CATCHUP;
      if (capped) elapsed = MAX_CATCHUP;
      acc += elapsed;
      let ran = 0;
      while (acc >= FIXED_DT && ran < MAX_STEPS) {
        step(FIXED_DT);
        acc -= FIXED_DT;
        ran += 1;
      }
      return ran;
    },
    alpha() {
      return clamp01(acc / FIXED_DT);
    },
    wasCapped() {
      return capped;
    },
    reset(nowMs: number) {
      lastMs = nowMs;
      acc = 0;
      capped = false;
    },
  };
}

type Pt = { x: number; y: number };
const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

/**
 * Blend two authoritative snapshots' POSITIONS for a smooth render between ticks.
 * Read-only and cosmetic: it never mutates `prev`/`curr` and returns fresh arrays,
 * so interpolated positions can never be fed back into the sim (integer-authority
 * rule). Non-positional fields are carried from `curr` (the latest truth).
 */
export function lerpSnapshot(prev: Snapshot, curr: Snapshot, a: number): Snapshot {
  const t = clamp01(a);
  return {
    ...curr,
    home: curr.home.map((p, i) => lerpPt(prev.home[i] ?? p, p, t)),
    away: curr.away.map((p, i) => lerpPt(prev.away[i] ?? p, p, t)),
    ball: { ...lerpPt(prev.ball ?? curr.ball, curr.ball, t), z: lerp((prev.ball ?? curr.ball).z, curr.ball.z, t) },
  };
}

export interface EventReconciliation {
  /** At most ONE ticker line to append (never a replayed batch). */
  ticker: string[];
  /** True when the caller should resync tracking refs to current truth and
   * SUPPRESS transient flashes (GOOOL / card pop) — a catch-up or a real freeze. */
  resync: boolean;
  /** The eventSeq to remember for the next reconcile. */
  nextSeq: number;
}

/**
 * Decide what to show for the sim's own events after an advance. A single new
 * event animates normally; a jump of more than one (catch-up) or a capped freeze
 * shows just the latest line and asks the caller to resync — so resuming a hidden
 * tab never replays a burst of stale captions/goal-flashes.
 */
export function reconcileEvents(prevSeq: number, snap: Snapshot, wasCapped: boolean): EventReconciliation {
  if (snap.eventSeq === prevSeq) return { ticker: [], resync: false, nextSeq: prevSeq };
  return {
    ticker: [snap.eventText],
    resync: wasCapped || snap.eventSeq - prevSeq > 1,
    nextSeq: snap.eventSeq,
  };
}
