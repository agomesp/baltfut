import { z } from "zod";

/**
 * Canonical vote contract — the SINGLE source of truth shared by:
 *   - the Next.js client (instant form feedback)
 *   - the `cast-vote` Supabase Edge Function (the authoritative gate)
 *
 * It lives under supabase/functions/_shared so the Deno function can import it
 * directly; the web app imports it via the "@shared/*" path alias. Keeping one
 * schema means client and server can never drift. This file is pure TS + zod
 * (no Deno or browser globals) so it runs in every runtime.
 */

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 24;
export const SCORE_MIN = 0;
/** Generous upper bound — blocks absurd values without ever clipping a real score. */
export const SCORE_MAX = 30;

/** A voter backs one of the two teams on the pitch (the side they support). */
export const PREFERRED_SIDES = ["home", "away"] as const;
export type PreferredSide = (typeof PREFERRED_SIDES)[number];

// Letters (any language), digits, spaces, and a few separators — no control
// chars, angle brackets, or punctuation that could carry markup/script.
const USERNAME_RE = /^[\p{L}\p{N} _.\-]+$/u;
const LEAGUE_RE = /^[a-z0-9.\-]+$/i;
const ID_RE = /^[A-Za-z0-9_-]+$/;
const ABBR_RE = /^[A-Za-z0-9]+$/;

export const voteInputSchema = z.object({
  matchId: z.string().min(1).max(64).regex(ID_RE, "invalid match id"),
  league: z.string().min(1).max(32).regex(LEAGUE_RE, "invalid league slug"),
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN, `username must be at least ${USERNAME_MIN} characters`)
    .max(USERNAME_MAX, `username must be at most ${USERNAME_MAX} characters`)
    .regex(USERNAME_RE, "username has invalid characters"),
  preferredSide: z.enum(PREFERRED_SIDES),
  preferredTeamAbbr: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .regex(ABBR_RE, "invalid team abbreviation"),
  predHome: z.number().int().min(SCORE_MIN).max(SCORE_MAX),
  predAway: z.number().int().min(SCORE_MIN).max(SCORE_MAX),
});

/** Clean, validated vote payload. Unknown keys are stripped, never trusted. */
export type VoteInput = z.infer<typeof voteInputSchema>;

export interface VoteValidationResult {
  success: boolean;
  /** Present only on success. */
  data?: VoteInput;
  /** field name -> first error message; present only on failure. */
  errors?: Record<string, string>;
}

/**
 * Validate an untrusted payload into a clean {@link VoteInput}.
 * Returns a flat field->message error map (UI-friendly) rather than throwing.
 */
export function validateVote(input: unknown): VoteValidationResult {
  const parsed = voteInputSchema.safeParse(input);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      errors[key] ??= issue.message;
    }
  }
  // Root-level failures (null, string, etc.) carry no field path.
  if (Object.keys(errors).length === 0) {
    errors._root = parsed.error.issues[0]?.message ?? "Invalid vote payload";
  }

  return { success: false, errors };
}
