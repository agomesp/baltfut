import { parseScoreboard } from "@/lib/espn/parse";
import type { Match } from "@/lib/espn/types";

/** FIFA World Cup. Swap for any ESPN soccer slug, e.g. "eng.1", "esp.1". */
export const DEFAULT_LEAGUE = "fifa.world";

/**
 * Date window covering the 2026 World Cup. Passed as `dates` to fetch the whole
 * tournament (live + upcoming + finished) in one call, which powers the Live,
 * Fixtures, and Results tabs.
 */
export const FIFA_WORLD_DATE_RANGE = "20260611-20260719";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

/** Build the scoreboard URL, encoding inputs so they can't escape the path/query. */
export function scoreboardUrl(league: string, dates?: string): string {
  const base = `${ESPN_BASE}/${encodeURIComponent(league)}/scoreboard`;
  // limit=400 lifts ESPN's default 100-event cap so the full 104-match schedule
  // (incl. the late knockout rounds) comes back — the bracket needs them.
  return dates ? `${base}?dates=${encodeURIComponent(dates)}&limit=400` : base;
}

export interface FetchScoreboardOptions {
  /** ESPN league slug; defaults to {@link DEFAULT_LEAGUE}. */
  league?: string;
  /** Date or range, e.g. "20260621" or "20260611-20260719". */
  dates?: string;
  /** Abort signal for cancellation / polling cleanup. */
  signal?: AbortSignal;
  /** Injectable fetch — overridden in tests; defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Fetch and normalize the scoreboard for a league (optionally a date range).
 *
 * ESPN's site API is keyless and CORS-open, so this runs directly in the
 * browser — there is no secret to protect. The response is validated and
 * normalized by {@link parseScoreboard} before it reaches the UI.
 */
export async function fetchScoreboard(
  options: FetchScoreboardOptions = {},
): Promise<Match[]> {
  const league = options.league ?? DEFAULT_LEAGUE;
  const doFetch = options.fetchImpl ?? fetch;

  const res = await doFetch(scoreboardUrl(league, options.dates), {
    signal: options.signal,
    headers: { accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `ESPN scoreboard request failed: ${res.status} ${res.statusText}`,
    );
  }

  const json: unknown = await res.json();
  return parseScoreboard(json, league);
}
