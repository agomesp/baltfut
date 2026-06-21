/** Palpites stay open until kickoff + this grace period (the first 5 minutes). */
export const PALPITE_GRACE_MS = 5 * 60_000;

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
