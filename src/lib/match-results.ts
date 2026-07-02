import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchResult } from "@/lib/ranking";

interface ResultRow {
  match_id: string;
  home_score: number;
  away_score: number;
  home_shootout: number | null;
  away_shootout: number | null;
}

/** A durable `match_results` row → the `MatchResult` shape the ranking grades on.
 *  Rows only exist for finished matches, so `state` is always "post". */
export function mapResultRow(row: ResultRow): MatchResult {
  return {
    state: "post",
    homeScore: row.home_score,
    awayScore: row.away_score,
    homeShootout: row.home_shootout,
    awayShootout: row.away_shootout,
  };
}

/**
 * Durable finished-match scores from the `match_results` table, keyed by ESPN
 * match id. The ranking prefers these over ESPN's live scoreboard so an ESPN
 * outage or dropped match can't erase old wins. Resilient: returns {} on any
 * error (e.g. the table not deployed yet) so the caller falls back to ESPN alone.
 * Bounded by the tournament size (~104 rows), so a single request is enough.
 */
export async function fetchMatchResults(
  client: SupabaseClient,
): Promise<Record<string, MatchResult>> {
  try {
    const { data, error } = await client
      .from("match_results")
      .select("match_id,home_score,away_score,home_shootout,away_shootout");
    if (error) throw new Error(error.message);
    const out: Record<string, MatchResult> = {};
    for (const row of (data as ResultRow[] | null) ?? []) out[row.match_id] = mapResultRow(row);
    return out;
  } catch {
    return {};
  }
}
