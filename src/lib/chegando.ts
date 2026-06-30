import type { VoteEntry } from "@/lib/votes";

// Pure helpers for the "PALPITES CHEGANDO" timeline (the live feed of arriving
// palpites). Kept out of the component so the change-detection + ordering rules are
// unit-tested. The votes feed keeps ONE row per user, so a user's row changing value
// means they re-palpited.

/** The value shown for an entry: the pen-winner team code (pen mode) or the score. */
export function chegandoValue(e: VoteEntry, pen: boolean, homeCode: string, awayCode: string): string {
  return pen ? (e.penWinner === "home" ? homeCode : awayCode) : `${e.predHome}×${e.predAway}`;
}

/**
 * Record any usernames whose value CHANGED since we last saw them (mutates `seen` to
 * the latest values) and return those usernames. The first time a name appears is NOT
 * a change — only a later, different value is. Drives the "alterado" highlight.
 */
export function detectChegandoChanges(
  entries: VoteEntry[],
  seen: Map<string, string>,
  pen: boolean,
  homeCode: string,
  awayCode: string,
): string[] {
  const changed: string[] = [];
  for (const e of entries) {
    const v = chegandoValue(e, pen, homeCode, awayCode);
    const had = seen.get(e.username);
    if (had !== undefined && had !== v) changed.push(e.username);
    seen.set(e.username, v);
  }
  return changed;
}

export interface ChegandoRowData {
  key: string;
  nick: string;
  value: string;
  changed: boolean;
  eventTime: number;
}

/**
 * Build the feed rows, most-recent EVENT first: a new palpite by its creation time, a
 * CHANGED one by the moment the change was noticed (`changedAt`) — so a re-palpite
 * bubbles to the top. One row per user (the feed key), so a changed row relocates to
 * the top instead of duplicating. Capped at `cap` (the list scrolls).
 */
export function buildChegandoRows(
  entries: VoteEntry[],
  changedAt: Map<string, number>,
  pen: boolean,
  homeCode: string,
  awayCode: string,
  cap = 24,
): ChegandoRowData[] {
  const list = pen ? entries.filter((e) => e.penWinner === "home" || e.penWinner === "away") : entries;
  return list
    .map((e) => {
      const ch = changedAt.get(e.username) ?? 0;
      return {
        key: e.username,
        nick: e.username,
        value: chegandoValue(e, pen, homeCode, awayCode),
        changed: ch > 0,
        eventTime: Math.max(Date.parse(e.createdAt) || 0, ch),
      };
    })
    .sort((a, b) => b.eventTime - a.eventTime)
    .slice(0, cap);
}
