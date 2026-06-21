import { getSupabaseClient } from "@/lib/supabase/client";
import type { CastVoteTransport } from "@/lib/votes/submit";

/**
 * Production transport: invokes the cast-vote Edge Function via supabase-js and
 * normalizes its response into { status, body } for {@link submitVote}.
 *
 * supabase-js reports non-2xx responses as a FunctionsHttpError whose `context`
 * is the raw Response — we read the status and JSON body from there so the
 * 409/422 handling in submitVote works.
 */
export const supabaseCastVote: CastVoteTransport = async (body) => {
  const client = getSupabaseClient();
  if (!client) {
    return { status: 0, body: { error: "Voting is not configured." } };
  }

  const { data, error } = await client.functions.invoke("cast-vote", { body });

  if (!error) {
    return { status: 201, body: data };
  }

  const context = (error as { context?: Response }).context;
  if (context && typeof context.status === "number") {
    let parsed: unknown;
    try {
      parsed = await context.clone().json();
    } catch {
      parsed = undefined;
    }
    return { status: context.status, body: parsed };
  }

  return { status: 0, body: { error: error.message } };
};
