"use client";

import {
  parseScoreboard,
  scoreboardUrl,
  DEFAULT_LEAGUE,
  FIFA_WORLD_DATE_RANGE,
  type Match,
} from "@/lib/espn";
import { startScoreboardWorker } from "@/lib/scoreboard-worker";

/**
 * Shared, ref-counted scoreboard source. ONE Web Worker polls ESPN's scoreboard
 * and broadcasts the parsed `Match[]` to every subscriber — so the live page,
 * Modo Streamer (PiP clock) and the PiP view share a single fetch + parse instead
 * of each running its own poller (audit A2). Worker-backed, so it escapes the
 * hidden-tab timer throttle for ALL consumers (the old PiP main-thread
 * `setInterval` did not).
 *
 * Mirrors the heartbeat singleton: first subscriber starts the worker, the last
 * unsubscribe stops it; a late subscriber gets the last good snapshot instantly.
 * Empty/failed parses are ignored (keep last good) — matching the old per-consumer
 * `if (next.length)` guards.
 */
const POLL_MS = 20_000;

type Listener = (matches: Match[]) => void;

const listeners = new Set<Listener>();
let stop: (() => void) | null = null;
let last: Match[] | null = null;

function start(): void {
  if (stop) return; // already polling
  stop = startScoreboardWorker(
    scoreboardUrl(DEFAULT_LEAGUE, FIFA_WORLD_DATE_RANGE),
    POLL_MS,
    (json) => {
      const next = parseScoreboard(json, DEFAULT_LEAGUE);
      if (!next.length) return; // ignore empty/failed parse — keep last good
      last = next;
      for (const l of listeners) l(next);
    },
  );
}

/**
 * Subscribe to scoreboard updates. The callback fires with the cached snapshot
 * immediately (if one exists) and on every subsequent poll. Returns an
 * unsubscribe; when the last subscriber leaves, the worker is stopped.
 */
export function subscribeScoreboard(fn: Listener): () => void {
  listeners.add(fn);
  start();
  if (last) fn(last); // hand a late subscriber the last good data right away
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && stop) {
      stop();
      stop = null;
    }
  };
}
