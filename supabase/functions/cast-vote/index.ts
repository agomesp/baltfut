// cast-vote — the ONLY writer to public.votes.
//
// Why an Edge Function instead of a direct insert from the browser:
//   * It runs server-side with the service_role key (never shipped to clients),
//     so anon has zero write access at the database (enforced by RLS).
//   * It derives the real client IP server-side and stores only a salted hash,
//     enforcing one-vote-per-IP-per-match via UNIQUE(match_id, ip_hash).
//   * It re-validates the payload with the SAME shared schema as the client.
//
// Deno-only file (Deno.serve / Deno.env / npm: imports). It is excluded from the
// app's tsconfig; Deno type-checks it on `supabase functions serve`/`deploy`.
import { createClient } from "@supabase/supabase-js";
import { validateVote } from "../_shared/vote.ts";
import { getClientIp, hashIp } from "../_shared/ip.ts";
import {
  buildCorsHeaders,
  parseAllowedOrigins,
  resolveAllowedOrigin,
} from "../_shared/cors.ts";

// Injected automatically by the Supabase platform.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Must be configured as function secrets (see .env.example / SECURITY.md).
const IP_PEPPER = Deno.env.get("VOTE_IP_PEPPER") ?? "";
const ALLOWED_ORIGINS = parseAllowedOrigins(Deno.env.get("ALLOWED_ORIGINS"));

function json(
  payload: unknown,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const allowOrigin = resolveAllowedOrigin(origin, ALLOWED_ORIGINS);
  const cors = buildCorsHeaders(allowOrigin);

  // Preflight.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return json({ error: "Método não permitido." }, 405, cors);
  }
  // Refuse cross-origin requests from origins we don't trust.
  if (origin && !allowOrigin) {
    return json({ error: "Origem não permitida." }, 403, cors);
  }
  // Fail closed if the server is missing its secrets.
  if (!IP_PEPPER || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "Servidor não configurado." }, 500, cors);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo da requisição inválido." }, 400, cors);
  }

  // The authoritative validation (the client's is only for UX).
  const result = validateVote(body);
  if (!result.success || !result.data) {
    return json({ error: "Falha na validação.", fields: result.errors }, 422, cors);
  }
  const vote = result.data;

  const ip = getClientIp(req.headers);
  if (!ip) {
    return json({ error: "Não foi possível identificar o cliente." }, 400, cors);
  }
  const ipHash = await hashIp(ip, IP_PEPPER);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.from("votes").insert({
    match_id: vote.matchId,
    league: vote.league,
    username: vote.username,
    pred_home: vote.predHome,
    pred_away: vote.predAway,
    ip_hash: ipHash,
  });

  if (error) {
    // 23505 = unique_violation: either one-per-IP or one-name-per-match.
    if (error.code === "23505") {
      const blob = `${error.message ?? ""} ${error.details ?? ""}`;
      const nameTaken = blob.includes("one_name");
      return json(
        {
          error: nameTaken
            ? "Esse nome já foi usado nesta partida."
            : "Você já palpitou nesta partida.",
        },
        409,
        cors,
      );
    }
    // Don't leak DB internals to the client; log server-side only.
    console.error("cast-vote insert failed:", error.code, error.message);
    return json({ error: "Não foi possível registrar seu palpite." }, 500, cors);
  }

  return json({ ok: true }, 201, cors);
});
