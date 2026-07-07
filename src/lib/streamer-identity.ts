"use client";

/**
 * Is THIS machine the streamer's? The streamer runs baltfut with the locked
 * nickname "Rodrigo Baltar" (localStorage `baltfut_name`, set by the name-claim —
 * see use-my-name). Only the streamer's browser is the captured on-stream screen,
 * so promo-view chat commands + the manual lock only act here.
 *
 * The name is only present once claimed (the claim locks it to this device's token),
 * so a plain name match is a good-enough gate for a display toggle. Case-insensitive.
 */
const STREAMER_NAME = "rodrigo baltar";

export function isStreamerMachine(): boolean {
  try {
    const n = localStorage.getItem("baltfut_name");
    return !!n && n.trim().toLowerCase() === STREAMER_NAME;
  } catch {
    return false;
  }
}
