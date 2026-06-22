"use client";

import { useEffect, useState } from "react";
import { subscribeHeartbeat } from "@/lib/heartbeat";

/**
 * Current epoch ms, refreshed every `intervalMs`. Also re-syncs immediately when
 * the tab becomes visible again — so a countdown that the browser throttled while
 * the tab was hidden snaps to the correct value the instant you return to it.
 *
 * It also ticks off a shared Web Worker heartbeat, whose timer isn't subject to
 * the hidden-tab throttle — so the clock/countdowns keep moving even while the
 * window is backgrounded (the captured view shows a live clock, not a frozen
 * number). The main-thread interval stays as foreground smoothness + fallback.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    const unsubscribe = subscribeHeartbeat(tick); // keeps ticking while hidden
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return now;
}
