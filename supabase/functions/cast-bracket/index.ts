// cast-bracket — the ONLY writer to public.bracket_palpites.
//
// Saves one knockout bracket per nickname (upsert). Same security model as
// cast-vote: runs server-side with the service_role key (anon has zero DB write,
// enforced by RLS), derives + hashes the client IP, re-validates with the SAME
// shared schema as the client, and enforces nickname ownership via name_claims.
//
// FOLLOW-UP (before the knockout stage begins): drop picks for ties whose real
// match has already kicked off, so a direct API POST can't score by submitting
// known results. Not needed yet — the knockout is entirely future (teams TBD),
// so no tie can be gamed today; the client already locks started ties in the UI.
//
// Deno-only file (Deno.serve / Deno.env / npm: imports). Excluded from the app's
// tsconfig; Deno type-checks it on `supabase functions serve`/`deploy`.
import { createClient } from "@supabase/supabase-js";
import { validateBracket } from "../_shared/bracket.ts";
import { decideClaim, isReservedName, nameSkeleton } from "../_shared/name-claim.ts";
import { getClientIp, hashIp, hashToken } from "../_shared/ip.ts";
import {
  buildCorsHeaders,
  parseAllowedOrigins,
  resolveAllowedOrigin,
} from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const IP_PEPPER = Deno.env.get("VOTE_IP_PEPPER") ?? "";
const ALLOWED_ORIGINS = parseAllowedOrigins(Deno.env.get("ALLOWED_ORIGINS"));

function json(payload: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const allowOrigin = resolveAllowedOrigin(origin, ALLOWED_ORIGINS);
  const cors = buildCorsHeaders(allowOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return json({ error: "Método não permitido." }, 405, cors);
  }
  if (origin && !allowOrigin) {
    return json({ error: "Origem não permitida." }, 403, cors);
  }
  if (!IP_PEPPER || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "Servidor não configurado." }, 500, cors);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo da requisição inválido." }, 400, cors);
  }

  // Authoritative validation (the client's is only for UX).
  const result = validateBracket(body);
  if (!result.success || !result.data) {
    return json({ error: "Falha na validação.", fields: result.errors }, 422, cors);
  }
  const bracket = result.data;

  // Reserved names (e.g. "ChatGPT", the house bot) belong to the app.
  if (isReservedName(bracket.username)) {
    return json({ error: "Esse nome é reservado. Escolha outro." }, 403, cors);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ip = getClientIp(req.headers);
  if (!ip) {
    return json({ error: "Não foi possível identificar o cliente." }, 400, cors);
  }
  const ipHash = await hashIp(ip, IP_PEPPER);

  // Nickname ownership — the SAME name_claims system as score palpites, so a
  // bracket is saved under the same identity. A secret token in the browser's
  // localStorage proves ownership; block anyone else while the claim is fresh.
  const rawToken = (body as { token?: unknown }).token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (token.length < 8 || token.length > 200) {
    return json({ error: "Requisição inválida." }, 400, cors);
  }
  const tokenHash = await hashToken(token, IP_PEPPER);
  const nameLower = bracket.username.trim().toLowerCase();
  const nameCanon = nameSkeleton(bracket.username);
  const [{ data: claim }, { data: lookalikes }] = await Promise.all([
    supabase.from("name_claims").select("token_hash,last_used_at").eq("name_lower", nameLower).maybeSingle(),
    supabase.from("name_claims").select("token_hash,last_used_at,name_lower").eq("name_canon", nameCanon).neq("name_lower", nameLower),
  ]);
  const nowMs = Date.now();
  const takenByLookalike = (lookalikes ?? []).some((c) => decideClaim(c, tokenHash, nowMs) === "taken");
  if (takenByLookalike || decideClaim(claim ?? null, tokenHash, nowMs) === "taken") {
    return json({ error: "Esse nome pertence a outra pessoa. Escolha outro." }, 403, cors);
  }

  // Upsert this nickname's bracket (one per name). The owner may re-save to refine
  // before the knockout; the started-tie lock (follow-up) will bound that later.
  const { error } = await supabase.from("bracket_palpites").upsert(
    {
      username: bracket.username.trim(),
      picks: bracket.picks,
      ip_hash: ipHash,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "username" },
  );
  if (error) {
    console.error("cast-bracket upsert failed:", error.code, error.message);
    return json({ error: "Não foi possível salvar seu chaveamento." }, 500, cors);
  }

  // Bracket saved — claim/refresh ownership of the name (best-effort).
  const { error: claimErr } = await supabase.from("name_claims").upsert(
    {
      name_lower: nameLower,
      name: bracket.username.trim(),
      name_canon: nameCanon,
      token_hash: tokenHash,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "name_lower" },
  );
  if (claimErr) console.error("name_claims upsert failed:", claimErr.code, claimErr.message);

  return json({ ok: true }, 201, cors);
});
