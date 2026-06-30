// Server-side palpite cutoff. Shared by the cast-vote Edge Function (Deno) and
// the Node unit tests. Pure — no Deno/Node globals — so both can import it.

export const PALPITE_GRACE_MS = 5 * 60_000; // mirrors the client's palpiteDeadline

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
  if (t.state === "post") return true;
  const text = `${t.detail ?? ""} ${t.clock ?? ""}`.toLowerCase();
  if (/\b(pen|shoot|p[êe]nal)/.test(text)) return true; // shootout in progress / decided
  const min = clockMinute(t.clock) ?? clockMinute(t.detail);
  return min != null && min >= etEndMin;
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
