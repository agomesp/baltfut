import { z } from "zod";

/**
 * Canonical prediction contract — the SINGLE source of truth shared by:
 *   - the Next.js client (instant form feedback)
 *   - the `cast-vote` Supabase Edge Function (the authoritative gate)
 *
 * A prediction is a name + a predicted scoreline. The live "winning / can win /
 * losing" ranking is derived elsewhere (client-side, vs the real score).
 *
 * Lives under supabase/functions/_shared so the Deno function imports it
 * directly; the web app imports it via the "@shared/*" path alias. Pure TS + zod
 * (no Deno/browser globals) so it runs in every runtime.
 */

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 24;
export const SCORE_MIN = 0;
/** Generous upper bound — blocks absurd values without ever clipping a real score. */
export const SCORE_MAX = 30;

// Latin-script letters (so accented pt-BR names like "José"/"Müller" pass),
// ASCII digits, spaces, and a few separators. Deliberately NO other scripts
// (Cyrillic/Greek) and NO non-ASCII digits — those are pure homoglyph vectors
// (a Cyrillic "а" reading as Latin "a") with no legitimate use here; the name
// skeleton folds the remaining same-script look-alikes. Still no control chars,
// angle brackets, or markup-bearing punctuation.
const USERNAME_RE = /^[\p{Script=Latin}0-9 _.\-]+$/u;
const LEAGUE_RE = /^[a-z0-9.\-]+$/i;
const ID_RE = /^[A-Za-z0-9_-]+$/;

export const voteInputSchema = z.object({
  matchId: z.string().min(1).max(64).regex(ID_RE, "invalid match id"),
  league: z.string().min(1).max(32).regex(LEAGUE_RE, "invalid league slug"),
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN, `username must be at least ${USERNAME_MIN} characters`)
    .max(USERNAME_MAX, `username must be at most ${USERNAME_MAX} characters`)
    .regex(USERNAME_RE, "username has invalid characters"),
  predHome: z.number().int().min(SCORE_MIN).max(SCORE_MAX),
  predAway: z.number().int().min(SCORE_MIN).max(SCORE_MAX),
  // Optional knockout penalty-shootout winner call (no score). Absent/null on
  // group palpites. Mirrors the votes.pen_winner CHECK ('home' | 'away' | null).
  penWinner: z.enum(["home", "away"]).nullish(),
});

/** Clean, validated prediction payload. Unknown keys are stripped, never trusted. */
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
  if (Object.keys(errors).length === 0) {
    errors._root = parsed.error.issues[0]?.message ?? "Invalid vote payload";
  }

  return { success: false, errors };
}
