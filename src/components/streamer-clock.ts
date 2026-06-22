/**
 * Match clock for the Modo Streamer PiP, ticked locally to the second.
 *
 * Purpose: a streamer window-capturing the page needs to SEE the clock moving to
 * trust the capture isn't frozen. ESPN reports only whole minutes (`displayClock`
 * like "67'"), which would sit static for up to a minute between polls — useless
 * as a liveness signal. So we count seconds within the current minute and HOLD at
 * :59 until the next poll bumps the minute, never displaying a minute ESPN hasn't
 * confirmed (so a stalled poll reads as a held clock, not a wrong one).
 *
 * Stoppage ("45'+2") and break labels ("Intervalo") aren't a tickable minute, so
 * we show them verbatim.
 *
 * @param displayClock ESPN's clock for the live match (null/"" when not live)
 * @param elapsedSec   seconds since `displayClock` was last fetched
 */
export function streamerClock(displayClock: string | null, elapsedSec: number): string {
  const raw = (displayClock ?? "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d+)'?$/);
  if (!m) return raw; // stoppage / break label → verbatim, don't tick
  const minute = Number(m[1]);
  const sec = Math.max(0, Math.min(59, Math.floor(elapsedSec)));
  return `${minute}:${String(sec).padStart(2, "0")}`;
}
