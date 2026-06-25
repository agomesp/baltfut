"use client";

/**
 * Shared "Modo Streamer" flag. `ModoStreamer` keeps it in sync; the update-banner
 * reads it (via `useSyncExternalStore`) to suppress its disruptive force-reload
 * while a broadcast is live — a `location.reload()` blanks/greys the captured tab.
 * Module singleton; mirrors the heartbeat store's subscribe shape (`() => void`).
 */
type Listener = () => void;

let active = false;
const listeners = new Set<Listener>();

export function isStreamerMode(): boolean {
  return active;
}

export function setStreamerMode(value: boolean): void {
  if (active === value) return;
  active = value;
  for (const l of listeners) l();
}

/** Subscribe to streamer-mode changes. Returns an unsubscribe. */
export function subscribeStreamerMode(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
