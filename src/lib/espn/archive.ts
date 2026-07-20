import type { SupabaseClient } from "@supabase/supabase-js";
import type { Match } from "@/lib/espn/types";
import type { Group } from "@/lib/espn/standings";
import type { MatchLineups } from "@/lib/espn/lineups";
import { parseScoreboard } from "@/lib/espn/parse";
import { parseStandings } from "@/lib/espn/standings";
import { parseLineups } from "@/lib/espn/lineups";

/**
 * Reads of the durable ESPN archive (`espn_matches` / `espn_standings` /
 * `espn_summaries`).
 *
 * The archive stores ESPN's RAW payloads, and every function here feeds them
 * back through the app's OWN parser — the same `parseScoreboard`/
 * `parseStandings`/`parseLineups` the live path uses. That is the whole design:
 * an archived match cannot drift from a live one, because there is only one
 * interpretation of the bytes. Re-implementing the parsing on the read side
 * would fork it and the divergence would be invisible until someone opened a
 * two-year-old match and found the wrong scorer.
 *
 * All three degrade quietly to empty rather than throwing — the archive is a
 * fallback, and a fallback that can take the page down is worse than no
 * fallback. Mirrors `fetchMatchResults`.
 */

/** Every archived match for a league, parsed exactly as the live scoreboard is. */
export async function fetchArchivedMatches(client: SupabaseClient, league: string): Promise<Match[]> {
  try {
    const { data, error } = await client
      .from("espn_matches")
      .select("raw")
      .eq("league", league)
      .order("starts_at", { ascending: true })
      // PostgREST caps responses around 1000 rows regardless of the limit asked
      // for — which already cost this project a wrong ranking once. A single
      // tournament is ~104 rows, but a long-running league would need paging.
      .limit(1000);
    if (error) throw new Error(error.message);
    const rows = (data as { raw: unknown }[] | null) ?? [];
    if (rows.length === 0) return [];
    // parseScoreboard expects the whole envelope, so rebuild it from the rows.
    return parseScoreboard({ events: rows.map((r) => r.raw) }, league);
  } catch {
    return [];
  }
}

/** The archived group tables for a league. */
export async function fetchArchivedStandings(client: SupabaseClient, league: string): Promise<Group[]> {
  try {
    const { data, error } = await client
      .from("espn_standings")
      .select("raw")
      .eq("league", league)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as { raw: unknown } | null;
    return row ? parseStandings(row.raw) : [];
  } catch {
    return [];
  }
}

/** The archived XI + substitutions for one match, or null when not archived. */
export async function fetchArchivedLineups(
  client: SupabaseClient,
  matchId: string,
): Promise<MatchLineups | null> {
  try {
    const { data, error } = await client
      .from("espn_summaries")
      .select("raw")
      .eq("match_id", matchId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as { raw: unknown } | null;
    return row ? parseLineups(row.raw) : null;
  } catch {
    return null;
  }
}
