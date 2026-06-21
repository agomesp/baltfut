import { parseScoreboard } from "@/lib/espn/parse";
import type { Match } from "@/lib/espn/types";

/** FIFA World Cup. Swap for any ESPN soccer slug, e.g. "eng.1", "esp.1". */
export const DEFAULT_LEAGUE = "fifa.world";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

/** Build the scoreboard URL, encoding the league so it can't escape the path. */
export function scoreboardUrl(league: string): string {
  return `${ESPN_BASE}/${encodeURIComponent(league)}/scoreboard`;
}

export interface FetchScoreboardOptions {
  /** ESPN league slug; defaults to {@link DEFAULT_LEAGUE}. */
  league?: string;
  /** Abort signal for cancellation / polling cleanup. */
  signal?: AbortSignal;
  /** Injectable fetch — overridden in tests; defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Fetch and normalize the live scoreboard for a league.
 *
 * ESPN's site API is keyless and CORS-open, so this runs directly in the
 * browser — there is no secret to protect here. The response is validated and
 * normalized by {@link parseScoreboard} before it reaches the UI.
 */
export async function fetchScoreboard(
  options: FetchScoreboardOptions = {},
): Promise<Match[]> {
  const league = options.league ?? DEFAULT_LEAGUE;
  const doFetch = options.fetchImpl ?? fetch;

  const res = await doFetch(scoreboardUrl(league), {
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
