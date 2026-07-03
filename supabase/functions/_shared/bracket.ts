import { z } from "zod";

/**
 * Canonical bracket-palpite contract — the SINGLE source of truth shared by:
 *   - the Next.js client (instant form feedback)
 *   - the `cast-bracket` Supabase Edge Function (the authoritative gate)
 *
 * A bracket submission is a nickname + a map of knockout positions to the picked
 * winner. Position keys are `${round}-${tie}` (round 0..4 = 32-avos..final); the
 * function cross-checks each pick against the real knockout and drops any tie
 * that has already kicked off (so nobody scores by submitting known results).
 *
 * Lives under supabase/functions/_shared so the Deno function imports it directly;
 * the web app imports it via "@shared/*". Pure TS + zod (no runtime globals).
 */

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 24;
/** A full bracket has 31 ties (16+8+4+2+1); allow a little slack, reject blobs. */
export const MAX_PICKS = 40;

// Same charset as the vote username: Latin letters (accents ok), digits, a few
// separators — no other scripts, no markup-bearing punctuation.
const USERNAME_RE = /^[\p{Script=Latin}0-9 _.\-]+$/u;
/** Bracket position key: `${round}-${tie}`, round 0..4, tie index 0..15. */
const POS_KEY_RE = /^[0-4]-(?:[0-9]|1[0-5])$/;
/** FIFA-style team abbreviation (BRA, RSA, USA…). */
const TEAM_CODE_RE = /^[A-Z]{2,4}$/;

export const bracketInputSchema = z.object({
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN, `username must be at least ${USERNAME_MIN} characters`)
    .max(USERNAME_MAX, `username must be at most ${USERNAME_MAX} characters`)
    .regex(USERNAME_RE, "username has invalid characters"),
  picks: z
    .record(z.string().regex(POS_KEY_RE, "invalid position"), z.string().regex(TEAM_CODE_RE, "invalid team"))
    .refine((p) => Object.keys(p).length >= 1, { message: "no picks" })
    .refine((p) => Object.keys(p).length <= MAX_PICKS, { message: "too many picks" }),
});

/** Clean, validated bracket payload. Unknown keys are stripped, never trusted. */
export type BracketInput = z.infer<typeof bracketInputSchema>;

export interface BracketValidationResult {
  success: boolean;
  /** Present only on success. */
  data?: BracketInput;
  /** field name -> first error message; present only on failure. */
  errors?: Record<string, string>;
}

/**
 * Validate an untrusted payload into a clean {@link BracketInput}.
 * Returns a flat field->message error map (UI-friendly) rather than throwing.
 */
export function validateBracket(input: unknown): BracketValidationResult {
  const parsed = bracketInputSchema.safeParse(input);
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
    errors._root = parsed.error.issues[0]?.message ?? "Invalid bracket payload";
  }

  return { success: false, errors };
}
