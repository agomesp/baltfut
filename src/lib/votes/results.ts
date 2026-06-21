import type { SupabaseClient } from "@supabase/supabase-js";

/** A single public prediction (from the vote_entries view — never includes ip_hash). */
export interface VoteEntry {
  matchId: string;
  league: string;
  username: string;
  predHome: number;
  predAway: number;
  createdAt: string;
}

interface EntryRow {
  match_id: string;
  league: string;
  username: string;
  pred_home: number;
  pred_away: number;
  created_at: string;
}

export function mapEntryRow(row: EntryRow): VoteEntry {
  return {
    matchId: row.match_id,
    league: row.league,
    username: row.username,
    predHome: row.pred_home,
    predAway: row.pred_away,
    createdAt: row.created_at,
  };
}

/** Fetch predictions for a match (newest first). */
export async function fetchVoteEntries(
  client: SupabaseClient,
  matchId: string,
  limit = 100,
): Promise<VoteEntry[]> {
  const { data, error } = await client
    .from("vote_entries")
    .select("*")
    .eq("match_id", matchId)
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as EntryRow[] | null)?.map(mapEntryRow) ?? [];
}

/** Fetch all predictions (for the ranking). Capped to keep the payload bounded. */
export async function fetchAllEntries(
  client: SupabaseClient,
  limit = 2000,
): Promise<VoteEntry[]> {
  const { data, error } = await client
    .from("vote_entries")
    .select("*")
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
