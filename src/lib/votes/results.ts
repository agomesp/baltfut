import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreferredSide } from "@shared/vote";

/** Aggregated crowd opinion for one match (from the vote_results view). */
export interface VoteResult {
  matchId: string;
  league: string;
  totalVotes: number;
  homeVotes: number;
  awayVotes: number;
  avgPredHome: number | null;
  avgPredAway: number | null;
}

/** A single public vote (from the vote_entries view — never includes ip_hash). */
export interface VoteEntry {
  matchId: string;
  league: string;
  username: string;
  preferredSide: PreferredSide;
  preferredTeamAbbr: string;
  predHome: number;
  predAway: number;
  createdAt: string;
}

interface ResultRow {
  match_id: string;
  league: string;
  total_votes: number;
  home_votes: number;
  away_votes: number;
  avg_pred_home: number | string | null;
  avg_pred_away: number | string | null;
  last_vote_at: string | null;
}

interface EntryRow {
  match_id: string;
  league: string;
  username: string;
  preferred_side: PreferredSide;
  preferred_team_abbr: string;
  pred_home: number;
  pred_away: number;
  created_at: string;
}

// PostgREST may serialize numeric() as a string; coerce defensively.
const num = (v: number | string | null): number | null =>
  v === null ? null : Number(v);

export function mapResultRow(row: ResultRow): VoteResult {
  return {
    matchId: row.match_id,
    league: row.league,
    totalVotes: row.total_votes,
    homeVotes: row.home_votes,
    awayVotes: row.away_votes,
    avgPredHome: num(row.avg_pred_home),
    avgPredAway: num(row.avg_pred_away),
  };
}

export function mapEntryRow(row: EntryRow): VoteEntry {
  return {
    matchId: row.match_id,
    league: row.league,
    username: row.username,
    preferredSide: row.preferred_side,
    preferredTeamAbbr: row.preferred_team_abbr,
    predHome: row.pred_home,
    predAway: row.pred_away,
    createdAt: row.created_at,
  };
}

/** Fetch aggregated results, optionally filtered to one match/league. */
export async function fetchVoteResults(
  client: SupabaseClient,
  opts: { matchId?: string; league?: string } = {},
): Promise<VoteResult[]> {
  let query = client.from("vote_results").select("*");
  if (opts.matchId) query = query.eq("match_id", opts.matchId);
  if (opts.league) query = query.eq("league", opts.league);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as ResultRow[] | null)?.map(mapResultRow) ?? [];
}

/** Fetch recent public entries for a match (newest first). */
export async function fetchVoteEntries(
  client: SupabaseClient,
  matchId: string,
  limit = 20,
): Promise<VoteEntry[]> {
  const { data, error } = await client
    .from("vote_entries")
    .select("*")
    .eq("match_id", matchId)
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as EntryRow[] | null)?.map(mapEntryRow) ?? [];
}
