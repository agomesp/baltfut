import type { SupabaseClient } from "@supabase/supabase-js";
import type { Side } from "@/lib/espn";

/** A single public prediction (from the vote_entries view — never includes ip_hash). */
export interface VoteEntry {
  matchId: string;
  league: string;
  username: string;
  predHome: number;
  predAway: number;
  /** Optional pick of who wins a penalty shootout (knockout only). null/undefined
   *  when not predicted. Scores 0.5 in the ranking when the tie goes to pens. */
  penWinner?: Side | null;
  createdAt: string;
}

interface EntryRow {
  match_id: string;
  league: string;
  username: string;
  pred_home: number;
  pred_away: number;
  pen_winner?: Side | null;
  created_at: string;
}

export function mapEntryRow(row: EntryRow): VoteEntry {
  return {
    matchId: row.match_id,
    league: row.league,
    username: row.username,
    predHome: row.pred_home,
    predAway: row.pred_away,
    penWinner: row.pen_winner ?? null,
    createdAt: row.created_at,
  };
}

/**
 * Fetch predictions for a match, newest first. The order is set explicitly here,
 * NOT left to the `vote_entries` view's internal ORDER BY — PostgREST doesn't
 * contractually preserve a view's order through an outer select+limit, and
 * `rankPredictions` relies on stable newest-first input (audit B1).
 */
export async function fetchVoteEntries(
  client: SupabaseClient,
  matchId: string,
  limit = 100,
): Promise<VoteEntry[]> {
  const { data, error } = await client
    .from("vote_entries")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as EntryRow[] | null)?.map(mapEntryRow) ?? [];
}

/**
 * Fetch all predictions (for the ranking), newest first, capped to keep the
 * payload bounded. The explicit ORDER BY (with a `match_id` tiebreaker) makes the
 * `.limit()` cut DETERMINISTIC: without it, which rows survive past the cap is
 * undefined, which would silently skew rankSubs/worstPalpiteiro once the table
 * grows beyond the limit (audit B1).
 */
export async function fetchAllEntries(
  client: SupabaseClient,
  limit = 2000,
): Promise<VoteEntry[]> {
  const { data, error } = await client
    .from("vote_entries")
    .select("*")
    .order("created_at", { ascending: false })
    .order("match_id")
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as EntryRow[] | null)?.map(mapEntryRow) ?? [];
}

/** Fetch prediction counts per match (which matches have palpites). */
export async function fetchVoteCounts(
  client: SupabaseClient,
): Promise<Record<string, number>> {
  const { data, error } = await client.from("vote_match_counts").select("*");
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of (data as { match_id: string; votes: number }[] | null) ?? []) {
    counts[row.match_id] = row.votes;
  }
  return counts;
}
