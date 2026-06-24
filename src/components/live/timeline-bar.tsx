"use client";

import { useState } from "react";
import type { Match } from "@/lib/espn";
import { useNow } from "@/lib/use-now";
import { eventMinute } from "@/components/live/bf-ui";

/**
 * Live match progress as 0–100% of a 90' match, advancing SMOOTHLY between the
 * ~20s scoreboard refreshes by interpolating real elapsed time from the last
 * reported clock — so the bar creeps forward continuously instead of only
 * jumping on a goal/card refresh. Holds steady at the half-time break (no
 * displayClock) and pins to 100% once finished; drift is capped so a stalled
 * feed can't run the bar away.
 */
export function useLiveElapsedPct(match: Match): number {
  const now = useNow(1000);
  const clockMin =
    match.state === "in" && match.displayClock ? eventMinute(match.displayClock) : null;
  // Anchor = the reported minute + when we first saw it. Re-anchored DURING render
  // whenever the reported clock advances (React's sanctioned "adjust state from a
  // changed prop" pattern — no effect, no ref read during render).
  const [anchor, setAnchor] = useState<{ clock: number | null; min: number; at: number }>({
    clock: clockMin,
    min: clockMin ?? 0,
    at: now,
  });
  if (clockMin !== anchor.clock) {
    setAnchor({ clock: clockMin, min: clockMin ?? anchor.min, at: now });
  }

  if (match.state === "post") return 100;
  if (match.state !== "in") return 0;
  // No live clock (the break) → freeze; otherwise creep forward, capped at +2'.
  const drift = clockMin == null ? 0 : Math.min(2, Math.max(0, (now - anchor.at) / 60_000));
  return Math.min(100, ((anchor.min + drift) / 90) * 100);
}

/**
 * The filling segment of the timeline track. Isolated into its own component so
 * only this tiny node re-renders each second (not the whole scoreboard), and the
 * width eases between ticks for a continuous "filling" feel.
 */
export function TimelineFill({ match }: { match: Match }) {
  const pct = useLiveElapsedPct(match);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: `${pct.toFixed(2)}%`,
        background: "linear-gradient(90deg,#3a7d2c,#c8ff2d)",
        borderRadius: 2,
        transition: "width 1s linear",
      }}
    />
  );
}
