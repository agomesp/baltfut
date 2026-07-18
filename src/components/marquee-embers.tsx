"use client";

import type { CSSProperties } from "react";

/**
 * Embers drifting up the marquee screen (final / 3rd place) like sparks off a
 * fire. Purely decorative: fixed behind the content (`z-index: -1`), never
 * clickable, and animated on transform+opacity only so the compositor handles it
 * — no per-frame paint during a multi-hour stream. `prefers-reduced-motion` stops
 * them via the global rule in globals.css.
 */

const COUNT = 22;

/** Deterministic pseudo-random in [0,1) — same value on server and client, so the
 *  field doesn't reshuffle on hydration. */
function rnd(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function MarqueeEmbers({ metal }: { metal: string }) {
  // The theme metal plus hotter tones, so it reads as fire rather than confetti.
  const palette = [metal, "#ff9a3c", "#ff6a1f", "#ffcf8a"];

  return (
    <div
      aria-hidden
      style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden" }}
    >
      {Array.from({ length: COUNT }).map((_, i) => {
        const size = 2 + rnd(i, 2) * 2.8;
        const color = palette[i % palette.length];
        const style: CSSProperties & Record<"--bf-dx", string> = {
          position: "absolute",
          left: `${rnd(i, 1) * 100}%`,
          bottom: `-${4 + rnd(i, 6) * 14}%`,
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 ${5 + size * 2}px ${color}`,
          opacity: 0,
          willChange: "transform, opacity",
          // Negative delay starts them mid-flight, so the screen is already alive.
          animation: `bfEmberRise ${11 + rnd(i, 3) * 9}s linear ${-rnd(i, 4) * 20}s infinite`,
          "--bf-dx": `${(rnd(i, 5) * 2 - 1) * 70}px`,
        };
        return <span key={i} style={style} />;
      })}
    </div>
  );
}
