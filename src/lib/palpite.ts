import type { Match } from "@/lib/espn";

/** Palpites stay open until kickoff + this grace period (the first 5 minutes). */
export const PALPITE_GRACE_MS = 5 * 60_000;

/**
 * Which matches are "released" for palpites: the current kickoff-hour group (the
 * earliest group not fully finished) plus the next group. Matches in the same
 * kickoff hour are grouped, so simultaneous matches all open together. Matches
 * beyond the next group are locked ("não liberados ainda"). Finished matches in
 * earlier groups stay released (they show winners, not the locked warning).
 */
export function releasedMatchIds(matches: Match[]): Set<string> {
  const byHour = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.startsAt.slice(0, 13); // YYYY-MM-DDTHH — kickoff-hour bucket
    const arr = byHour.get(key);
    if (arr) arr.push(m);
    else byHour.set(key, [m]);
  }
  const hours = [...byHour.keys()].sort();
  let current = hours.findIndex((h) =>
    byHour.get(h)!.some((m) => m.state !== "post"),
  );
  if (current === -1) current = Math.max(0, hours.length - 1); // all finished
  const released = new Set<string>();
  for (const h of hours.slice(0, current + 2)) {
    for (const m of byHour.get(h)!) released.add(m.id);
  }
  return released;
}

/** Deadline (ms) to submit a palpite for a match: kickoff + grace. NaN if unknown. */
export function palpiteDeadline(startsAt: string): number {
  const t = Date.parse(startsAt);
  return Number.isNaN(t) ? NaN : t + PALPITE_GRACE_MS;
}

/** Whether palpites are still open at `now` (false if the deadline is unknown). */
export function isPalpiteOpen(deadline: number, now: number): boolean {
  return !Number.isNaN(deadline) && now < deadline;
}

/** Remaining ms -> "M:SS" (minutes may exceed 59), clamped at 0:00. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Remaining ms -> "H:MM:SS" when an hour or more away, else "M:SS". */
export function formatCountdownLong(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
