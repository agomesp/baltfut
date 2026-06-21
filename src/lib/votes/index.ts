/**
 * App-facing vote module. Re-exports the canonical contract that lives under
 * supabase/functions/_shared so the Edge Function and the web app validate with
 * identical rules. Client-only helpers (e.g. submitVote) will be added here.
 */
export {
  validateVote,
  voteInputSchema,
  PREFERRED_SIDES,
  USERNAME_MIN,
  USERNAME_MAX,
  SCORE_MIN,
  SCORE_MAX,
  type PreferredSide,
  type VoteInput,
  type VoteValidationResult,
} from "@shared/vote";
