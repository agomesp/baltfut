"use client";

import { useEffect, useState } from "react";

/**
 * Current epoch ms, refreshed every `intervalMs`. Also re-syncs immediately when
 * the tab becomes visible again — so a countdown that the browser throttled while
 * the tab was hidden snaps to the correct value the instant you return to it,
 * instead of waiting up to a minute for the next throttled tick.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return now;
}
