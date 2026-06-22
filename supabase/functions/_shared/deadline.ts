// Server-side palpite cutoff. Shared by the cast-vote Edge Function (Deno) and
// the Node unit tests. Pure — no Deno/Node globals — so both can import it.

export const PALPITE_GRACE_MS = 5 * 60_000; // mirrors the client's palpiteDeadline

interface EspnSummaryLike {
  header?: {
    competitions?: Array<{
      date?: string;
      status?: { type?: { state?: string } };
    }>;
  };
}

export interface MatchTiming {
  /** Kickoff epoch ms, or NaN when the payload doesn't carry it. */
  kickoffMs: number;
  /** ESPN state: "pre" | "in" | "post" | null. */
  state: string | null;
}

/** Pull kickoff + state out of an ESPN `summary?event=…` payload. */
export function matchTimingFromSummary(summary: unknown): MatchTiming {
  const comp = (summary as EspnSummaryLike)?.header?.competitions?.[0];
  return {
    kickoffMs: comp?.date ? Date.parse(comp.date) : Number.NaN,
    state: comp?.status?.type?.state ?? null,
  };
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
