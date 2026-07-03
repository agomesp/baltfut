import type { Match } from "@/lib/espn";
import { isReservedName } from "@shared/name-claim";

/** Palpites stay open until kickoff + this grace period (the first 5 minutes). */
export const PALPITE_GRACE_MS = 5 * 60_000;

/**
 * How long the live palpite FORM stays on screen AFTER the submit deadline. The
 * form would otherwise unmount the instant the window closes — so a palpite sent
 * in the last second (whose server response, often a rejection, lands just after
 * the deadline) had its outcome rendered on an unmounted component and vanished
 * silently. Keeping the form mounted for this tail lets that result/error show;
 * submits during the tail are themselves closed and report it. See
 * {@link palpiteFormVisible}.
 */
export const FORM_TAIL_MS = 30_000;

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

/** Is `openUntil` a usable manual-override timestamp (finite epoch ms)? */
function hasOverride(openUntil?: number | null): openUntil is number {
  return openUntil != null && Number.isFinite(openUntil);
}

/**
 * The effective submit deadline for a match: the admin's manual `openUntil`
 * override when one is set (extend / reopen / close-early), otherwise the default
 * kickoff + grace. Mirrors the server's `palpitesClosedWithOverride`, so the form's
 * countdown and gating line up with what cast-vote will actually accept.
 */
export function effectiveDeadline(startsAt: string, openUntil?: number | null): number {
  return hasOverride(openUntil) ? openUntil : palpiteDeadline(startsAt);
}

/** Whether palpites are still open at `now` (false if the deadline is unknown). */
export function isPalpiteOpen(deadline: number, now: number): boolean {
  return !Number.isNaN(deadline) && now < deadline;
}

/**
 * Whether the palpite FORM should be available for `match` now: it's released
 * (current/next kickoff group) AND still inside the kickoff+grace window. So it's
 * open pre-match and for the first 5 live minutes, then closes. Both the single
 * (PlacarStage) and 2-game (DuoStage) live views gate on this, so a live match
 * keeps its form for exactly the grace period in either layout.
 */
export function palpiteFormOpen(
  match: Match,
  releasedIds: Set<string>,
  now: number,
  openUntil?: number | null,
): boolean {
  // A manual override fully decides the window (and bypasses the released-group
  // gate, so a reopened finished match shows the form again).
  if (hasOverride(openUntil)) return now <= openUntil;
  return releasedIds.has(match.id) && isPalpiteOpen(palpiteDeadline(match.startsAt), now);
}

/**
 * Whether the palpite form should be RENDERED for `match` now. Same gate as
 * {@link palpiteFormOpen} but extended by {@link FORM_TAIL_MS} past the deadline,
 * so the form stays mounted long enough to surface a near-deadline submit's
 * result. Whether a submit is actually accepted is still decided by
 * {@link isPalpiteOpen} (this only controls visibility) — during the tail the
 * form shows a closed state.
 */
export function palpiteFormVisible(
  match: Match,
  releasedIds: Set<string>,
  now: number,
  openUntil?: number | null,
): boolean {
  if (hasOverride(openUntil)) return now < openUntil + FORM_TAIL_MS;
  const deadline = palpiteDeadline(match.startsAt);
  return releasedIds.has(match.id) && !Number.isNaN(deadline) && now < deadline + FORM_TAIL_MS;
}

/**
 * The palpites a viewer may SEE for a match's feed/list. While the window is
 * still open the house bot's (ChatGPT's) pick is withheld — so nobody can copy
 * the AI's palpite before locking in their own — then it's revealed the moment
 * palpites close, like everyone else's. The bot's row stays in the DB and in
 * scoring/ranking; this gates DISPLAY only. Generic over any row with a
 * `username` (VoteEntry, chegando rows, optimistic sends).
 */
export function visiblePalpites<T extends { username: string }>(entries: T[], palpitesOpen: boolean): T[] {
  return palpitesOpen ? entries.filter((e) => !isReservedName(e.username)) : entries;
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
