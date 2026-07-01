"use client";

/**
 * A0.3 — a ~15 Hz metronome from a Web Worker. When the tab is hidden, rAF is
 * paused and main-thread timers are throttled to ~1/s (or worse), which freezes
 * the match. A worker's `setInterval` escapes that throttle, so subscribers keep
 * getting ticks and the sim/clock keep advancing while backgrounded — the render
 * simply catches up (via the sim-clock's bounded catch-up) when the tab returns.
 *
 * Same proven, static-export-safe shape as `heartbeat.ts`/`scoreboard-worker.ts`:
 * the worker is built from a self-contained source STRING via a Blob object-URL —
 * no bundled chunk, so no webpack `publicPath`/basePath dependency (a bundled
 * `new URL(..., import.meta.url)` worker would 404 under GitHub Pages' /baltfut).
 * Singleton + refcounted so a StrictMode double-mount can't spawn or leak workers,
 * with a `typeof Worker === "undefined"` guard so SSR/export never throws.
 *
 * 66 ms (~15 Hz) rather than heartbeat's 1 Hz so a hidden match still progresses
 * smoothly; the sim-clock caps how much each tick may advance regardless.
 */
type Listener = () => void;

let worker: Worker | null = null;
let objUrl = "";
const listeners = new Set<Listener>();

function ensureWorker(): void {
  if (worker || typeof Worker === "undefined") return;
  try {
    objUrl = URL.createObjectURL(
      new Blob(["setInterval(function(){postMessage(0);},66);"], { type: "application/javascript" }),
    );
    worker = new Worker(objUrl);
    worker.onmessage = () => {
      for (const l of listeners) l();
    };
  } catch {
    worker = null;
  }
}

/** Run `fn` ~15×/second, even while the tab is hidden. Returns an unsubscribe.
 * A no-op (still callable) when Worker is unavailable. */
export function subscribeMetronome(fn: Listener): () => void {
  listeners.add(fn);
  ensureWorker();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && worker) {
      worker.terminate();
      worker = null;
      if (objUrl) {
        URL.revokeObjectURL(objUrl);
        objUrl = "";
      }
    }
  };
}
