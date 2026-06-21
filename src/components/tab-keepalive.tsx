"use client";

import { useEffect } from "react";

/**
 * Keeps the tab from being throttled while hidden.
 *
 * Browsers clamp setInterval/setTimeout to ~once per minute once a tab has been
 * hidden for a few minutes (minimized, background tab, or fully occluded). That
 * freezes our live countdown and pauses the auto-refresh — which is exactly what
 * a streamer sees when their capture window isn't focused.
 *
 * A tab that is "playing audio" is exempt from that throttling. So once the user
 * interacts (autoplay needs a gesture), we start a WebAudio graph with a tiny,
 * inaudible gain — silent to humans, but enough for the browser to treat the tab
 * as active and keep the timers running at full speed even while hidden.
 */
export function TabKeepAlive() {
  useEffect(() => {
    type ACtor = typeof AudioContext;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: ACtor }).webkitAudioContext;
    if (!Ctor) return;

    let ctx: AudioContext | null = null;

    const ensure = () => {
      if (!ctx) {
        try {
          ctx = new Ctor();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.0008; // ~ -62 dBFS: inaudible, still counts as audio
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
        } catch {
          /* AudioContext unavailable — nothing we can do, fall back to throttling */
          ctx = null;
          return;
        }
      }
      void ctx.resume?.();
    };

    // Autoplay policy: the context can only start after a user gesture. Streamers
    // (and viewers) click to pick a match, so the first interaction arms it.
    window.addEventListener("pointerdown", ensure);
    window.addEventListener("keydown", ensure);
    // Browsers can suspend the context when hidden; resume it on return.
    const onVisible = () => {
      if (!document.hidden) ensure();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("pointerdown", ensure);
      window.removeEventListener("keydown", ensure);
      document.removeEventListener("visibilitychange", onVisible);
      void ctx?.close?.();
    };
  }, []);

  return null;
}
