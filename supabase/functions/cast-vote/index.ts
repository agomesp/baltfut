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
import { matchTimingFromSummary, palpitesClosedWithOverride, penWindowClosed } from "../_shared/deadline.ts";
import { decideClaim, isReservedName, nameSkeleton } from "../_shared/name-claim.ts";
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

// Realtime nudge: tell subscribed clients a palpite landed for this match so they
// refetch the public feed immediately (instead of waiting for the poll). Carries
// NO vote data — only the match id (already public) — so it cannot leak ip_hash.
// Best-effort; the write is already saved, so a hung endpoint must never block.
async function broadcastPalpite(matchId: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [{ topic: `palpites:${matchId}`, event: "new", payload: {}, private: false }],
      }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    /* best-effort — clients still get the poll fallback */
  }
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

  // Anti-troll: a score of 10+ for either side is never a real prediction — it's
  // only used to game the live "ganhando/pode ganhar" ranking. Reject it, but
  // with the same "name taken" message so the real reason isn't obvious.
  if (vote.predHome >= 10 || vote.predAway >= 10) {
    return json({ error: "Esse nome pertence a outra pessoa. Escolha outro." }, 403, cors);
  }

  // Reserved names (e.g. "ChatGPT", the house bot) belong to the app — its
  // palpites are seeded server-side. Nobody may palpite under them.
  if (isReservedName(vote.username)) {
    return json({ error: "Esse nome é reservado. Escolha outro." }, 403, cors);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // A manual per-match window set from the admin tool: when present it overrides
  // the default score cutoff (extend / reopen / close early), so a window the admin
  // opens lets this submit through. Fetched in parallel with ESPN below.
  const overridePromise = supabase
    .from("palpite_overrides")
    .select("open_until")
    .eq("match_id", vote.matchId)
    .maybeSingle();

  // Server-side cutoff, using ESPN as the trusted clock (enforced even when a
  // client bypasses the UI). Two different deadlines:
  //   * SCORE palpite: closed once finished OR past kickoff + 5min — UNLESS a
  //     manual admin window (palpite_overrides) says otherwise.
  //   * PEN-WINNER vote on an existing palpite: stays open through regulation +
  //     extra time, and closes the moment the shootout starts (or, failing a clear
  //     ESPN signal, once the clock passes 120') — so picking after pens begin is
  //     impossible.
  // Fail open on any ESPN/network error so a hiccup never blocks a legit palpite.
  let scoreClosed = false;
  let penClosed = false;
  const { data: override } = await overridePromise;
  const openUntil = override?.open_until ? Date.parse(override.open_until) : null;
  try {
    const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(
      vote.league,
    )}/summary?event=${encodeURIComponent(vote.matchId)}`;
    // 2s timeout: a HUNG ESPN (vs an error) would otherwise stall the only write
    // path until the platform hard-timeout. On abort, fall through to fail-open.
    const espn = await fetch(summaryUrl, { signal: AbortSignal.timeout(2000) });
    if (espn.ok) {
      const timing = matchTimingFromSummary(await espn.json());
      scoreClosed = palpitesClosedWithOverride(timing, Date.now(), { openUntil });
      penClosed = penWindowClosed(timing);
    }
  } catch {
    /* ESPN unreachable — fail open (both flags stay false) */
  }
  // ESPN errored but the admin explicitly CLOSED the window early (openUntil in the
  // past): honor that even on the fail-open path so an early close still sticks.
  if (openUntil != null && Date.now() > openUntil) scoreClosed = true;
  // A pen-winner vote needs the pen window; a score palpite needs the score window.
  if (vote.penWinner ? penClosed : scoreClosed) {
    return json(
      { error: vote.penWinner ? "Pênaltis encerrados para esta partida." : "Palpites encerrados para esta partida." },
      403,
      cors,
    );
  }
  // Past the score window but the pen window is still open: ONLY a pen-winner vote
  // on an existing palpite is allowed (no new score palpites / no score changes).
  // (Only reached for penWinner requests, since a score palpite past the window was
  // already rejected above.)
  const penOnly = scoreClosed;

  const ip = getClientIp(req.headers);
  if (!ip) {
    return json({ error: "Não foi possível identificar o cliente." }, 400, cors);
  }
  const ipHash = await hashIp(ip, IP_PEPPER);

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
  // Canonical "skeleton" of the name, so visual look-alikes ("Rodrigo BaItar"
  // with a capital-I vs "Rodrigo Baltar") share one identity and can't be used
  // to impersonate an existing owner. We check BOTH the exact name's claim and
  // any DIFFERENT name with the same skeleton; if either is owned by a different,
  // still-fresh token, reject.
  const nameCanon = nameSkeleton(vote.username);
  const [{ data: claim }, { data: lookalikes }] = await Promise.all([
    supabase.from("name_claims").select("token_hash,last_used_at").eq("name_lower", nameLower).maybeSingle(),
    supabase.from("name_claims").select("token_hash,last_used_at,name_lower").eq("name_canon", nameCanon).neq("name_lower", nameLower),
  ]);
  const nowMs = Date.now();
  const takenByLookalike = (lookalikes ?? []).some((c) => decideClaim(c, tokenHash, nowMs) === "taken");
  if (takenByLookalike || decideClaim(claim ?? null, tokenHash, nowMs) === "taken") {
    return json(
      { error: "Esse nome pertence a outra pessoa. Escolha outro." },
      403,
      cors,
    );
  }

  // Past the score window (match still live, pens not started): set OR CHANGE the
  // pen winner on the caller's existing row — never insert a late palpite. Keyed on
  // (match, ip_hash) so it can only touch their own row. Overwrites, so the pick can
  // be changed right up to the shootout (the penClosed gate above shuts it then).
  if (penOnly) {
    const { data: updated, error: updErr } = await supabase
      .from("votes")
      .update({ pen_winner: vote.penWinner })
      .eq("match_id", vote.matchId)
      .eq("ip_hash", ipHash)
      .select("id");
    if (updErr) {
      console.error("cast-vote pen update failed:", updErr.code, updErr.message);
      return json({ error: "Não foi possível registrar seu palpite." }, 500, cors);
    }
    if (updated && updated.length > 0) {
      await broadcastPalpite(vote.matchId);
      return json({ ok: true }, 200, cors);
    }
    // No palpite from this IP on this match — nothing to attach a pen to.
    return json({ error: "Palpites encerrados para esta partida." }, 403, cors);
  }

  const { error } = await supabase.from("votes").insert({
    match_id: vote.matchId,
    league: vote.league,
    username: vote.username,
    pred_home: vote.predHome,
    pred_away: vote.predAway,
    pen_winner: vote.penWinner ?? null,
    ip_hash: ipHash,
  });

  if (error) {
    // 23505 = unique_violation: either one-per-IP or one-name-per-match.
    if (error.code === "23505") {
      // Pen vote: the caller ALREADY palpitado this match from this IP (the score
      // is locked) and is setting OR CHANGING the penalty winner on that row. Keyed
      // on (match_id, ip_hash) — the caller's OWN row — so it can never touch
      // someone else's pick, and the deadline gate above still applies. Overwrites,
      // so the pick can be changed until the shootout.
      if (vote.penWinner) {
        const { data: updated, error: updErr } = await supabase
          .from("votes")
          .update({ pen_winner: vote.penWinner })
          .eq("match_id", vote.matchId)
          .eq("ip_hash", ipHash)
          .select("id");
        if (updErr) {
          console.error("cast-vote pen update failed:", updErr.code, updErr.message);
          return json({ error: "Não foi possível registrar seu palpite." }, 500, cors);
        }
        if (updated && updated.length > 0) {
          await broadcastPalpite(vote.matchId);
          return json({ ok: true }, 200, cors);
        }
        // No row for this IP (a genuine name collision from another IP) → fall
        // through to the duplicate message.
      }
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
      name_canon: nameCanon,
      token_hash: tokenHash,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "name_lower" },
  );
  if (claimErr) console.error("name_claims upsert failed:", claimErr.code, claimErr.message);

  // Realtime nudge so subscribed clients refetch the public feed immediately.
  await broadcastPalpite(vote.matchId);

  return json({ ok: true }, 201, cors);
});
