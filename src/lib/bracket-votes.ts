import type { SupabaseClient } from "@supabase/supabase-js";
import { validateBracket, type BracketInput } from "@shared/bracket";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ownerToken } from "@/lib/owner-token";

/**
 * Client helpers for the bracket palpite: submit a saved knockout to the
 * `cast-bracket` Edge Function (the only writer) and read the public
 * `bracket_entries` feed. Mirrors the score-palpite module (votes/*): the
 * transport is injectable so the submit logic is unit-testable.
 */

export type CastBracketTransport = (body: BracketInput) => Promise<{ status: number; body: unknown }>;

export type SubmitBracketOutcome =
  | { ok: true }
  | { ok: false; status?: number; message: string; fields?: Record<string, string> };

/** Validate locally (same schema as the server) for instant feedback, then POST. */
export async function submitBracket(
  input: unknown,
  transport: CastBracketTransport,
): Promise<SubmitBracketOutcome> {
  const validated = validateBracket(input);
  if (!validated.success || !validated.data) {
    return { ok: false, message: "Corrija os campos destacados.", fields: validated.errors };
  }

  let res: { status: number; body: unknown };
  try {
    res = await transport(validated.data);
  } catch {
    return { ok: false, message: "Erro de rede — tente novamente." };
  }

  if (res.status === 200 || res.status === 201) return { ok: true };
  const body = (res.body ?? {}) as { error?: string; fields?: Record<string, string> };
  if (res.status === 422) {
    return { ok: false, status: 422, message: body.error ?? "Falha na validação.", fields: body.fields };
  }
  return {
    ok: false,
    status: res.status,
    message: body.error ?? "Não foi possível salvar seu chaveamento. Tente novamente.",
  };
}

/** Production transport: invokes cast-bracket via supabase-js, attaching the
 *  owner token, and normalizes the response into { status, body }. */
export const supabaseCastBracket: CastBracketTransport = async (body) => {
  const client = getSupabaseClient();
  if (!client) return { status: 0, body: { error: "Não configurado." } };

  const { data, error } = await client.functions.invoke("cast-bracket", {
    body: { ...body, token: ownerToken() },
  });
  if (!error) return { status: 201, body: data };

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

// ---------------------------------------------------------------------------
// Read side
// ---------------------------------------------------------------------------

/** A public bracket palpite (from the bracket_entries view — never includes ip_hash). */
export interface BracketEntry {
  username: string;
  picks: Record<string, string>;
  updatedAt: string;
}

interface BracketRow {
  username: string;
  picks: Record<string, string> | null;
  updated_at: string;
}

export function mapBracketRow(row: BracketRow): BracketEntry {
  return { username: row.username, picks: (row.picks ?? {}) as Record<string, string>, updatedAt: row.updated_at };
}

/**
 * Fetch every saved bracket (newest first). Resilient: returns [] on any error
 * (unconfigured client, missing table before deploy), so the ranking degrades to
 * score-palpite points only instead of throwing.
 */
export async function fetchBracketEntries(client: SupabaseClient): Promise<BracketEntry[]> {
  try {
    const { data, error } = await client
      .from("bracket_entries")
      .select("username, picks, updated_at")
      .order("updated_at", { ascending: false });
    if (error) return [];
    return ((data as BracketRow[] | null) ?? []).map(mapBracketRow);
  } catch {
    return [];
  }
}
