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
import { matchTimingFromSummary, palpitesClosed } from "../_shared/deadline.ts";
import { decideClaim, isReservedName } from "../_shared/name-claim.ts";
import { getClientIp, hashIp, hashToken } from "../_shared/ip.ts";
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

  // Reserved names (e.g. "ChatGPT", the house bot) belong to the app — its
  // palpites are seeded server-side. Nobody may palpite under them.
  if (isReservedName(vote.username)) {
    return json({ error: "Esse nome é reservado. Escolha outro." }, 403, cors);
  }

  // Server-side cutoff: reject palpites for matches that have finished or are past
  // kickoff + 5min, using ESPN as the trusted clock. This enforces the deadline
  // even when a client bypasses the UI (e.g. POSTing directly to the API), so a
  // finished/old match can't be palpited to game the ranking. Fail open on any
  // ESPN/network error so a hiccup never blocks legitimate palpites.
  try {
    const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(
      vote.league,
    )}/summary?event=${encodeURIComponent(vote.matchId)}`;
    const espn = await fetch(summaryUrl);
    if (espn.ok) {
      const timing = matchTimingFromSummary(await espn.json());
      if (palpitesClosed(timing, Date.now())) {
        return json({ error: "Palpites encerrados para esta partida." }, 403, cors);
      }
    }
  } catch {
    /* ESPN unreachable — fail open */
  }

  const ip = getClientIp(req.headers);
  if (!ip) {
    return json({ error: "Não foi possível identificar o cliente." }, 400, cors);
  }
  const ipHash = await hashIp(ip, IP_PEPPER);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Nickname ownership: a name belongs to the first person who used it, proved by
  // a secret token in their browser's localStorage. Block anyone else from
  // palpiting under that name while the claim is fresh (the owner palpited within
  // the last 24h); after that it goes stale and can be re-claimed.
  const rawToken = (body as { token?: unknown }).token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (token.length < 8 || token.length > 200) {
    return json({ error: "Requisição inválida." }, 400, cors);
  }
  const tokenHash = await hashToken(token, IP_PEPPER);
  const nameLower = vote.username.trim().toLowerCase();
  const { data: claim } = await supabase
    .from("name_claims")
    .select("token_hash,last_used_at")
    .eq("name_lower", nameLower)
    .maybeSingle();
  if (decideClaim(claim ?? null, tokenHash, Date.now()) === "taken") {
    return json(
      { error: "Esse nome pertence a outra pessoa. Escolha outro." },
      403,
      cors,
    );
  }

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
      // PostgREST puts the violated columns in `details` (e.g. "lower(username)")
      // and may omit the index name, so match on the column too.
      const blob = `${error.message ?? ""} ${error.details ?? ""}`;
      const nameTaken = blob.includes("one_name") || blob.includes("username");
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

  // Palpite recorded — claim/refresh ownership of the name (best-effort).
  const { error: claimErr } = await supabase.from("name_claims").upsert(
    {
      name_lower: nameLower,
      name: vote.username.trim(),
      token_hash: tokenHash,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "name_lower" },
  );
  if (claimErr) console.error("name_claims upsert failed:", claimErr.code, claimErr.message);

  // Realtime nudge: tell subscribed clients a palpite landed for this match so
  // they refetch the public feed immediately (instead of waiting for the poll).
  // SECURITY: this carries NO vote data — only the match id (already public) —
  // so it cannot leak ip_hash. The authoritative rows still come from the
  // column-restricted `vote_entries` view. Best-effort; never blocks the vote.
  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [{ topic: `palpites:${vote.matchId}`, event: "new", payload: {}, private: false }],
      }),
    });
  } catch {
    /* best-effort — clients still get the poll fallback */
  }

  return json({ ok: true }, 201, cors);
});
