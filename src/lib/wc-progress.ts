/**
 * World Cup 2026 tournament progress, echoed in the masthead ("… · 34% CONCLUÍDA")
 * and the full-bleed top progress bar. Linear from the opening match to the final.
 * Anchored in UTC so it's deterministic and testable regardless of the viewer's tz.
 */
export const WC_START_MS = Date.parse("2026-06-11T00:00:00Z");
export const WC_END_MS = Date.parse("2026-07-19T23:59:59Z");

export interface WcProgress {
  /** 0..1 fraction elapsed, clamped. */
  ratio: number;
  /** Rounded whole-percent for the label. */
  pct: number;
}

export function wcProgress(
  now: number,
  start = WC_START_MS,
  end = WC_END_MS,
): WcProgress {
  const ratio = Math.max(0, Math.min(1, (now - start) / (end - start)));
  return { ratio, pct: Math.round(ratio * 100) };
}
