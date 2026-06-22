"use client";

/**
 * A shared 1 Hz heartbeat from a Web Worker. Worker timers escape the hidden-tab
 * throttle (which clamps main-thread timers to ~1/min after 5 min hidden), so the
 * clock/countdowns keep ticking — and the captured view keeps visibly moving —
 * even when the streamer's window is backgrounded. Singleton: every `useNow()`
 * consumer shares one worker, created lazily and torn down when the last one
 * unsubscribes. Built from a Blob so it needs no separate bundled file.
 */
type Listener = () => void;

let worker: Worker | null = null;
let objUrl = "";
const listeners = new Set<Listener>();

function ensureWorker(): void {
  if (worker || typeof Worker === "undefined") return;
  try {
    objUrl = URL.createObjectURL(
      new Blob(["setInterval(function(){postMessage(0);},1000);"], { type: "application/javascript" }),
    );
    worker = new Worker(objUrl);
    worker.onmessage = () => {
      for (const l of listeners) l();
    };
  } catch {
    worker = null;
  }
}

/** Run `fn` ~once a second, even while the tab is hidden. Returns an unsubscribe. */
export function subscribeHeartbeat(fn: Listener): () => void {
  ensureWorker();
  listeners.add(fn);
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
