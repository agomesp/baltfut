#!/usr/bin/env node
// Snapshot every FINISHED match's final score from ESPN into the Supabase
// `match_results` table (via the set_match_results RPC). The page grades the
// Ranking dos Subs against this durable copy first, so an ESPN outage or a
// dropped/changed old match can't erase anyone's wins. No git commit → NO Pages
// deploy → open viewers don't reload; the ranking picks it up on the next poll.
//
// Run:  node scripts/results-pull.mjs            (Node 22: `nvm use 22`)
// Cron: .github/workflows/results.yml — needs repo secrets
//   NEXT_PUBLIC_SUPABASE_URL   (already set)
//   SUPABASE_SERVICE_ROLE_KEY  (Supabase → Settings → API → service_role)
//
// Without creds (local dev) it just parses + prints, writing nothing.
const LEAGUE = process.env.LEAGUE || "fifa.world";
const DATES = process.env.DATES || "20260611-20260719";
const ESPN = `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(LEAGUE)}/scoreboard?dates=${DATES}&limit=400`;

const res = await fetch(ESPN, { headers: { accept: "application/json" } });
if (!res.ok) { console.error(`✋ ESPN returned ${res.status}`); process.exit(1); }
const json = await res.json();

const num = (v) => (v == null ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
const items = [];
for (const e of json.events ?? []) {
  if (e.status?.type?.state !== "post") continue; // finished matches only
  const c = e.competitions?.[0];
  const h = c?.competitors?.find((x) => x.homeAway === "home");
  const a = c?.competitors?.find((x) => x.homeAway === "away");
  if (!h || !a) continue;
  const hs = num(h.score), as = num(a.score);
  if (hs == null || as == null) continue;
  items.push({
    match_id: String(e.id),
    league: LEAGUE,
    home_score: hs,
    away_score: as,
    home_shootout: num(h.shootoutScore),
    away_shootout: num(a.shootoutScore),
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (SUPABASE_URL && SERVICE_ROLE) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_match_results`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}`, "content-type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!r.ok) { console.error(`✋ set_match_results failed: ${r.status} ${await r.text()}`); process.exit(1); }
  console.log(`✓ upserted ${items.length} finished results → Supabase (no deploy, no reload)`);
} else {
  console.log(`(local; set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to upsert) ${items.length} finished results parsed`);
}
for (const i of items.slice(0, 5)) {
  const pen = i.home_shootout != null ? ` (pen ${i.home_shootout}-${i.away_shootout})` : "";
  console.log(`  · ${i.match_id} ${i.home_score}-${i.away_score}${pen}`);
}
