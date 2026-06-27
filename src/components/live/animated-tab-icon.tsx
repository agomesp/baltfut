"use client";

import type { CSSProperties } from "react";
import type { ViewKey } from "@/components/header";

/**
 * Custom dock icons that loop-animate when their tab is selected — a tailored
 * micro-animation per icon (see each case). Inactive tabs render the same icon
 * static. The AI icon is always painted with the rainbow gradient (matching the
 * house-bot styling), ignoring `color`.
 */
const COMMON = {
  fill: "none",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Animation shorthand for an element, only when the tab is active. */
function a(active: boolean, name: string, dur: number, delay = 0): CSSProperties | undefined {
  return active ? { animation: `${name} ${dur}s ${delay}s infinite` } : undefined;
}

export function AnimatedTabIcon({ view, size = 18, color = "currentColor", animate = false }: { view: ViewKey; size?: number; color?: string; animate?: boolean }) {
  const svg = { width: size, height: size, viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg" } as const;

  switch (view) {
    // AO VIVO — broadcast/wifi: center dot + 3 arcs each side pulsing in then out.
    case "live":
      return (
        <svg {...svg} stroke={color} {...COMMON}>
          <circle cx="12" cy="12" r="2" fill={color} stroke="none" />
          <path d="M15.2 8.8 A4.5 4.5 0 0 1 15.2 15.2" style={a(animate, "bfwifi1", 2.2)} />
          <path d="M8.8 8.8 A4.5 4.5 0 0 0 8.8 15.2" style={a(animate, "bfwifi1", 2.2)} />
          <path d="M17 7 A7 7 0 0 1 17 17" style={a(animate, "bfwifi2", 2.2)} />
          <path d="M7 7 A7 7 0 0 0 7 17" style={a(animate, "bfwifi2", 2.2)} />
          <path d="M18.7 5.3 A9.5 9.5 0 0 1 18.7 18.7" style={a(animate, "bfwifi3", 2.2)} />
          <path d="M5.3 5.3 A9.5 9.5 0 0 0 5.3 18.7" style={a(animate, "bfwifi3", 2.2)} />
        </svg>
      );

    // JOGOS — calendar whose day dots fill in sequence (a schedule populating).
    case "matches":
      return (
        <svg {...svg} stroke={color} {...COMMON}>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
          <line x1="8" y1="3" x2="8" y2="6.5" />
          <line x1="16" y1="3" x2="16" y2="6.5" />
          {[
            [8, 13.5], [12, 13.5], [16, 13.5], [8, 17], [12, 17],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="1.15" fill={color} stroke="none" style={a(animate, "bfchase", 1.6, i * 0.12)} />
          ))}
        </svg>
      );

    // GRUPOS — 2×2 grid whose cells light clockwise.
    case "groups":
      return (
        <svg {...svg} stroke={color} {...COMMON}>
          {[
            [4, 4], [13, 4], [13, 13], [4, 13],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="7" height="7" rx="1.5" style={a(animate, "bfchase", 1.5, i * 0.16)} />
          ))}
        </svg>
      );

    // RESULTADOS — checklist whose checks tick in sequence.
    case "results":
      return (
        <svg {...svg} stroke={color} {...COMMON}>
          {[6, 12, 18].map((y, i) => (
            <path key={i} d={`M3.5 ${y} l1.6 1.6 l3 -3.4`} style={a(animate, "bfchase", 1.5, i * 0.18)} />
          ))}
          <line x1="11" y1="6" x2="20.5" y2="6" />
          <line x1="11" y1="12" x2="20.5" y2="12" />
          <line x1="11" y1="18" x2="20.5" y2="18" />
        </svg>
      );

    // CHAVEAMENTO — two seeds merging into one, nodes pulsing toward the winner.
    case "bracket":
      return (
        <svg {...svg} stroke={color} {...COMMON}>
          <path d="M5 7 H12 V12 H18" />
          <path d="M5 17 H12 V12" />
          <circle cx="5" cy="7" r="1.9" fill={color} stroke="none" style={a(animate, "bfchase", 1.5, 0)} />
          <circle cx="5" cy="17" r="1.9" fill={color} stroke="none" style={a(animate, "bfchase", 1.5, 0.16)} />
          <circle cx="18" cy="12" r="1.9" fill={color} stroke="none" style={a(animate, "bfchase", 1.5, 0.32)} />
        </svg>
      );

    // AI — rainbow sparkles that twinkle.
    case "ai":
      return (
        <svg {...svg} {...COMMON} stroke="none">
          <defs>
            <linearGradient id="bfAiDockGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ff3b30" />
              <stop offset="0.2" stopColor="#ff9500" />
              <stop offset="0.4" stopColor="#ffcc00" />
              <stop offset="0.6" stopColor="#34c759" />
              <stop offset="0.8" stopColor="#0a84ff" />
              <stop offset="1" stopColor="#bf5af2" />
            </linearGradient>
          </defs>
          <path d="M12 3 C12.7 7.6 13.4 9.3 18 10 C13.4 10.7 12.7 12.4 12 17 C11.3 12.4 10.6 10.7 6 10 C10.6 9.3 11.3 7.6 12 3 Z" fill="url(#bfAiDockGrad)" style={a(animate, "bftwinkle", 1.8)} />
          <path d="M18.6 4 C18.8 5.4 19.1 5.7 20.5 6 C19.1 6.3 18.8 6.6 18.6 8 C18.4 6.6 18.1 6.3 16.7 6 C18.1 5.7 18.4 5.4 18.6 4 Z" fill="url(#bfAiDockGrad)" style={a(animate, "bftwinkle", 1.4, 0.5)} />
          <path d="M5.6 15 C5.8 16.1 6.1 16.4 7.3 16.6 C6.1 16.8 5.8 17.1 5.6 18.4 C5.4 17.1 5.1 16.8 3.9 16.6 C5.1 16.4 5.4 16.1 5.6 15 Z" fill="url(#bfAiDockGrad)" style={a(animate, "bftwinkle", 1.4, 0.9)} />
        </svg>
      );

    default:
      return null;
  }
}
