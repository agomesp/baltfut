import { validateVote, type VoteInput } from "@shared/vote";

/**
 * Transport that performs the actual POST to the cast-vote Edge Function and
 * returns a normalized { status, body }. Injected so the decision logic below is
 * fully unit-testable; the production implementation lives in ./transport.ts.
 */
export type CastVoteTransport = (
  body: VoteInput,
) => Promise<{ status: number; body: unknown }>;

export type SubmitOutcome =
  | { ok: true }
  | { ok: false; status?: number; message: string; fields?: Record<string, string> };

/**
 * Validate a vote locally for instant feedback, then submit it. Local
 * validation uses the SAME schema the Edge Function enforces, so a payload that
 * passes here will pass server-side too (the server remains the real gate).
 */
export async function submitVote(
  input: unknown,
  transport: CastVoteTransport,
): Promise<SubmitOutcome> {
  const validated = validateVote(input);
  if (!validated.success || !validated.data) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fields: validated.errors,
    };
  }

  let res: { status: number; body: unknown };
  try {
    res = await transport(validated.data);
  } catch {
    return { ok: false, message: "Network error — please try again." };
  }

  if (res.status === 200 || res.status === 201) {
    return { ok: true };
  }
  if (res.status === 409) {
    return {
      ok: false,
      status: 409,
      message: "You have already voted on this match.",
    };
  }

  const body = (res.body ?? {}) as { error?: string; fields?: Record<string, string> };
  if (res.status === 422) {
    return {
      ok: false,
      status: 422,
      message: body.error ?? "Validation failed.",
      fields: body.fields,
    };
  }
  return {
    ok: false,
    status: res.status,
    message: body.error ?? "Could not record your vote. Please try again.",
  };
}
