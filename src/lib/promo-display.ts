"use client";

/**
 * Shared "show promos on the live page" flag. The button in the Modo Streamer PiP
 * flips it; the live view reads it (via `useSyncExternalStore`) and swaps the
 * live-match palpites area for the big RB Store promo panel — letting a streamer
 * put sponsor deals on screen and switch back to palpites with one click.
 *
 * Module singleton; mirrors the streamer-mode store's subscribe shape (`() => void`).
 */
type Listener = () => void;

let active = false;
const listeners = new Set<Listener>();

export function isPromoDisplay(): boolean {
  return active;
}

export function setPromoDisplay(value: boolean): void {
  if (active === value) return;
  active = value;
  for (const l of listeners) l();
}

export function togglePromoDisplay(): void {
  setPromoDisplay(!active);
}

/** Subscribe to promo-display changes. Returns an unsubscribe. */
export function subscribePromoDisplay(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
