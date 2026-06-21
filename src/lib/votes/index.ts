/**
 * App-facing vote module. Re-exports the canonical contract that lives under
 * supabase/functions/_shared so the Edge Function and the web app validate with
 * identical rules, plus client helpers.
 */
export {
  validateVote,
  voteInputSchema,
  USERNAME_MIN,
  USERNAME_MAX,
  SCORE_MIN,
  SCORE_MAX,
  type VoteInput,
  type VoteValidationResult,
} from "@shared/vote";

export {
  submitVote,
  type CastVoteTransport,
  type SubmitOutcome,
} from "@/lib/votes/submit";
export { supabaseCastVote } from "@/lib/votes/transport";
export {
  mapEntryRow,
  fetchVoteEntries,
  fetchVoteCounts,
  type VoteEntry,
} from "@/lib/votes/results";
export {
  classifyPrediction,
  rankPredictions,
  type PredictionStatus,
  type RankedPrediction,
} from "@/lib/votes/predictions";
