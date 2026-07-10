#!/usr/bin/env node
// Fill the "ChatGPT" house-bot palpites from ESPN into Supabase `votes` (via the
// set_ai_palpites RPC). Runs the SAME deterministic strength model the app shows,
// for every fixture with two decided teams — backfilling any past match the bot
// missed and pre-filling upcoming ones (and each knockout tie the moment ESPN
// fills in the real teams). `on conflict do nothing` means a recorded pick is
// never rewritten, so re-running is a no-op and the 2026-06-22 seed is preserved.
//
// No git commit → NO Pages deploy → open viewers don't reload; the ranking + the
// AI tab pick the new rows up on their next poll.
//
// Run:  node scripts/ai-palpite-pull.mjs          (Node 22: `nvm use 22`)
// Cron: .github/workflows/ai-palpites.yml — needs repo secrets
//   NEXT_PUBLIC_SUPABASE_URL   (already set)
//   SUPABASE_SERVICE_ROLE_KEY  (Supabase → Settings → API → service_role)
// Without creds (local dev) it just computes + prints, writing nothing.
import { buildAiPalpiteItems } from "../src/lib/ai-palpite/pull-core.mjs";

const LEAGUE = process.env.LEAGUE || "fifa.world";
const DATES = process.env.DATES || "20260611-20260719";
const ESPN = `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(LEAGUE)}/scoreboard?dates=${DATES}&limit=400`;

const res = await fetch(ESPN, { headers: { accept: "application/json" } });
if (!res.ok) { console.error(`✋ ESPN returned ${res.status}`); process.exit(1); }
const json = await res.json();

const items = buildAiPalpiteItems(json.events ?? [], LEAGUE);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (SUPABASE_URL && SERVICE_ROLE) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_ai_palpites`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}`, "content-type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!r.ok) { console.error(`✋ set_ai_palpites failed: ${r.status} ${await r.text()}`); process.exit(1); }
  const inserted = await r.json().catch(() => null);
  console.log(`✓ ${items.length} bot palpites offered → ${inserted ?? "?"} new rows inserted (no deploy, no reload)`);
} else {
  console.log(`(local; set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to upsert) ${items.length} bot palpites computed`);
}
for (const i of items.slice(0, 5)) {
  const pen = i.pen_winner ? ` [pen: ${i.pen_winner}]` : "";
  console.log(`  · ${i.match_id} ${i.pred_home}-${i.pred_away}${pen}`);
}
