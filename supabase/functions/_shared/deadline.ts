// Server-side palpite cutoff. Shared by the cast-vote Edge Function (Deno) and
// the Node unit tests. Pure — no Deno/Node globals — so both can import it.

export const PALPITE_GRACE_MS = 15 * 60_000; // mirrors the client's palpiteDeadline

interface EspnSummaryLike {
  header?: {
    competitions?: Array<{
      date?: string;
      status?: {
        displayClock?: string;
        type?: { state?: string; name?: string; shortDetail?: string; description?: string };
      };
    }>;
  };
}

export interface MatchTiming {
  /** Kickoff epoch ms, or NaN when the payload doesn't carry it. */
  kickoffMs: number;
  /** ESPN state: "pre" | "in" | "post" | null. */
  state: string | null;
  /** Human status text (name + shortDetail/description), e.g. "FT", "Pens", "120'". */
  detail?: string | null;
  /** Live game clock, e.g. "62'", "120'+2'". */
  clock?: string | null;
}

/** Pull kickoff + state + status detail/clock out of an ESPN `summary?event=…`. */
export function matchTimingFromSummary(summary: unknown): MatchTiming {
  const comp = (summary as EspnSummaryLike)?.header?.competitions?.[0];
  const t = comp?.status?.type;
  return {
    kickoffMs: comp?.date ? Date.parse(comp.date) : Number.NaN,
    state: t?.state ?? null,
    detail: [t?.name, t?.shortDetail, t?.description].filter(Boolean).join(" ") || null,
    clock: comp?.status?.displayClock ?? null,
  };
}

/** Leading minute of an ESPN clock/detail string ("120'+2'" → 120, "FT" → null). */
function clockMinute(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d{1,3})\s*'/);
  return m ? Number(m[1]) : null;
}

/** End of extra time (90' regulation + 30' ET); the shootout starts after this. */
export const EXTRA_TIME_END_MIN = 120;

/**
 * Has the penalty-winner vote window closed? It must shut BEFORE the shootout —
 * picking the winner once pens have begun would be unfair. Closed when:
 *   - the match is finished (`post`), OR
 *   - ESPN's status text signals a shootout ("pen"/"shoot"/"penal"), OR
 *   - the clock has passed the end of extra time (≥120') — the robust fallback for
 *     when ESPN doesn't expose a distinct shootout status.
 * Pure (no globals); shared by PenVote (client) and cast-vote (server).
 */
export function penWindowClosed(
  t: { state: string | null; detail?: string | null; clock?: string | null },
  etEndMin = EXTRA_TIME_END_MIN,
): boolean {
  if (penWindowHardClosed(t)) return true;
  const min = clockMinute(t.clock) ?? clockMinute(t.detail);
  return min != null && min >= etEndMin;
}

/**
 * The IRREVERSIBLE part of the pen cutoff: the match has finished, or ESPN signals
 * the shootout is underway/decided. Unlike the 120' clock fallback, this can't be
 * overridden — a manual "keep it open" (admin) still yields to a real shootout/FT.
 */
export function penWindowHardClosed(t: { state: string | null; detail?: string | null }): boolean {
  if (t.state === "post") return true;
  return /\b(pen|shoot|p[êe]nal)/.test(`${t.detail ?? ""}`.toLowerCase());
}

/** How many minutes before the shootout (120') the pen-winner UI appears. */
export const PEN_VOTE_LEAD_MIN = 10;

/**
 * Whether the pen-winner UI — the "QUEM VENCE NOS PÊNALTIS?" picker AND the
 * by-pen palpite split — should be SHOWN yet. To keep it relevant, it stays
 * hidden until the match is within {@link PEN_VOTE_LEAD_MIN} of the shootout —
 * i.e. the clock has reached `EXTRA_TIME_END_MIN - lead` (110') — then auto-shows
 * and stays through extra time, the shootout, and the finished result. Hidden
 * pre-match and through regulation/early extra time. Pure; shared by PenVote and
 * the live palpites split.
 */
export function penVoteVisible(
  t: { state: string | null; detail?: string | null; clock?: string | null },
  etEndMin = EXTRA_TIME_END_MIN,
  leadMin = PEN_VOTE_LEAD_MIN,
): boolean {
  if (penWindowHardClosed(t)) return true; // shootout / FT / finished → keep the result visible
  const min = clockMinute(t.clock) ?? clockMinute(t.detail);
  return min != null && min >= etEndMin - leadMin;
}

/**
 * Palpites are closed once the match has finished, or once kickoff + grace has
 * passed. If the kickoff is unknown AND the match isn't marked finished we treat
 * it as open (fail open) so an ESPN hiccup never blocks a legitimate palpite —
 * the manual data cleanup remains the backstop for that rare case.
 */
export function palpitesClosed(
  timing: MatchTiming,
  now: number,
  grace = PALPITE_GRACE_MS,
): boolean {
  if (timing.state === "post") return true;
  if (!Number.isNaN(timing.kickoffMs)) return now > timing.kickoffMs + grace;
  return false;
}

/** A manual, per-match palpite window set from the admin tool. */
export interface PalpiteOverride {
  /**
   * Epoch ms until which score palpites are open for this match. When set to a
   * finite number it FULLY decides the score window (open iff `now <= openUntil`),
   * overriding both the finished state and the default grace — so the admin can
   * extend the window, reopen a finished match, or close it early. `null`/non-finite
   * means "no override" and the default {@link palpitesClosed} rule applies.
   */
  openUntil: number | null;
}

/**
 * {@link palpitesClosed}, but honoring a manual per-match override. The same source
 * of truth runs on the server (cast-vote) and the client, so a window the admin
 * opens lets real viewers actually submit (cast-vote accepts) AND re-enables their
 * form (client). With no override it is identical to {@link palpitesClosed}.
 */
export function palpitesClosedWithOverride(
  timing: MatchTiming,
  now: number,
  override?: PalpiteOverride | null,
  grace = PALPITE_GRACE_MS,
): boolean {
  const openUntil = override?.openUntil;
  if (openUntil != null && Number.isFinite(openUntil)) return now > openUntil;
  return palpitesClosed(timing, now, grace);
}
