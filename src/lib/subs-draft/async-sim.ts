// Cooperative time-slicing for the heavy headless sim (perf: kill the freeze).
//
// After xG-unification every match is a full TOTAL_STEPS sim (~65ms at the 3-min clock). Computing a whole
// matchday (24) or a whole tournament replay (up to ~72) in one synchronous burst froze
// the main thread for ~0.5s / ~1.6s. This yields to the event loop between matches so
// React + the rAF spotlight pump keep breathing — the hard freeze becomes a responsive
// (progress-reporting) stretch. It is NOT a worker: the app is a static export under a
// basePath where a bundled worker 404s (see sim-metronome.ts), so keeping the work on the
// main thread but SLICED is the static-export-safe win. Determinism is untouched — each
// match is a pure function of its seed, so the ORDER/timing of computing them never
// changes the results (matches within a stage are independent; status threads BETWEEN
// stages, which the callers still do sequentially).

/** Yield a macrotask to the event loop WITHOUT setTimeout's ~4ms clamp, and without
 * being gated by rAF (so it still drains while the tab is hidden). Falls back to
 * setTimeout where MessageChannel is absent (old/SSR). */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === "undefined") {
      setTimeout(resolve, 0);
      return;
    }
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(null);
  });
}

export interface ChunkOpts {
  /** Abort mid-run (e.g. the user hit Reiniciar / left the stage). Throws AbortError. */
  signal?: AbortSignal;
  /** How many items to compute between yields. 1 = smoothest (yield every match). */
  batch?: number;
  /** Called after each item with (completed, total) — drives a progress indicator. */
  onProgress?: (done: number, total: number) => void;
}

/** True when a thrown error is the AbortError computeChunked raises on signal.aborted.
 * (DOMException isn't always `instanceof Error` across runtimes, so match on name.) */
export function isAbort(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { name?: unknown }).name === "AbortError";
}

/**
 * Map `fn` over `items`, yielding to the event loop every `batch` items so the work
 * never blocks the main thread for long. Results are returned in input order (so the
 * output is deterministic + zippable back to the items). Rejects with an AbortError the
 * moment `signal` is aborted — the caller drops the partial result and never commits it.
 */
export async function computeChunked<T, R>(items: readonly T[], fn: (item: T) => R, opts: ChunkOpts = {}): Promise<R[]> {
  const { signal, batch = 1, onProgress } = opts;
  const step = Math.max(1, Math.floor(batch));
  const out: R[] = [];
  for (let i = 0; i < items.length; i++) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    out.push(fn(items[i]));
    onProgress?.(i + 1, items.length);
    if ((i + 1) % step === 0 && i + 1 < items.length) await yieldToMain();
  }
  return out;
}
