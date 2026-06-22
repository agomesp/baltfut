import type { Match } from "@/lib/espn";

/** The four mini-view shapes the floating score window can take. */
export type PipLayout = "bar" | "square" | "full" | "wide";

/**
 * Target PiP window size (OUTER, incl. the title bar) per layout. Chosen so the
 * responsive resolver lands on the matching layout once the window is that size,
 * with enough height margin that the title bar can't push Largo down into Barra.
 */
export const LAYOUT_SIZE: Record<PipLayout, [number, number]> = {
  bar: [560, 110],
  square: [200, 200],
  full: [360, 440],
  wide: [620, 180],
};

/**
 * Map a window's INNER content box to a layout. `wasBar` adds hysteresis on the
 * thin-strip boundary (enter Barra below 100px, leave only above 115px) so a
 * window resting near the line doesn't flip-flop and Largo never resolves to
 * Barra.
 */
export function resolveLayout(w: number, h: number, wasBar: boolean): PipLayout {
  const ar = w / h;
  if (h < (wasBar ? 115 : 100)) return "bar";
  if (w < 280 && h < 280 && ar < 1.5) return "square";
  if (ar >= 1.9) return "wide";
  return "full";
}

/** Minute used only for ordering events; "45'+2'" sorts just after "45'". */
export function clockOrder(clock: string): number {
  const m = String(clock).match(/(\d+)(?:'?\s*\+\s*(\d+))?/);
  if (!m) return 9999;
  return Number(m[1]) + (m[2] ? Number(m[2]) / 100 : 0);
}

/**
 * Pick the match the floating window should show: a live one first, else the
 * soonest upcoming, else the most recent finished. Pure (takes `nowMs`).
 */
export function pickMatch(matches: Match[], nowMs: number): Match | null {
  const live = matches.find((m) => m.state === "in");
  if (live) return live;
  const upcoming = matches
    .filter((m) => m.state === "pre" && Date.parse(m.startsAt) >= nowMs)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  if (upcoming.length) return upcoming[0];
  const past = matches
    .filter((m) => m.state === "post")
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  return past[0] ?? matches[0] ?? null;
}

/** Escape text before it goes into innerHTML (usernames, scorer names, etc.). */
export function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
