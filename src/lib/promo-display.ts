"use client";

/**
 * Shared "show promos on the live page" flag. The Modo Streamer PiP button and the
 * main-UI "Mostrar Promos" button flip it; the live view reads it (via
 * `useSyncExternalStore`) and swaps the live-match palpites area for the RB Store
 * promo Spotlight — letting a streamer put sponsor deals on screen and switch back
 * to palpites with one click.
 *
 * `locked`: when the STREAMER forces promos on (their manual button click), chat
 * `!palpites` can't revert it. Chat `!promo` / `!palpites` drive the view otherwise
 * (see applyPromoCommand). The streamer clears the lock by switching back to palpites.
 *
 * Module singleton; mirrors the streamer-mode store's subscribe shape (`() => void`).
 */
import type { PromoCommand } from "@/lib/promo-command";

type Listener = () => void;

let active = false;
let locked = false;
const listeners = new Set<Listener>();

export function isPromoDisplay(): boolean {
  return active;
}

/** True while the streamer has pinned promos on — chat can't switch back. */
export function isPromoLocked(): boolean {
  return locked;
}

/** Set the promo view on/off. `opts.lock` (when given) also sets/clears the streamer
 *  lock; omit it to leave the lock unchanged. */
export function setPromoDisplay(value: boolean, opts?: { lock?: boolean }): void {
  const nextLocked = opts?.lock ?? locked;
  if (active === value && locked === nextLocked) return;
  active = value;
  locked = nextLocked;
  for (const l of listeners) l();
}

export function togglePromoDisplay(): void {
  setPromoDisplay(!active);
}

/** Apply a viewer chat command. `!promo` shows promos (never touches the lock);
 *  `!palpites` hides them UNLESS the streamer has locked promos on. */
export function applyPromoCommand(cmd: PromoCommand): void {
  if (cmd === "promo") {
    setPromoDisplay(true);
    return;
  }
  if (locked) return; // streamer pinned promos — chat can't revert
  setPromoDisplay(false);
}

/** Subscribe to promo-display (active or lock) changes. Returns an unsubscribe. */
export function subscribePromoDisplay(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
