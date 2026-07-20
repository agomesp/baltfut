#!/usr/bin/env node
// Archive every ESPN payload the app renders into Supabase, so the tournament
// stays readable after ESPN stops serving it.
//
// `results-pull.mjs` already protects the SCORES (match_id → 2-1). This protects
// the RECORD: team names, crests, kickoff, venue, stage, scorers, cards, group
// tables and lineups all come from ESPN on every page load today, keyed by an
// opaque event id that nothing in our database can resolve. ESPN is keyless and
// unofficial — the day those ids age out, we still own every palpite but can no
// longer say which match any of them was about.
//
// Stores ESPN's RAW payloads. The app's zod-validated parser reads them back, so
// an archived match can never drift from a live one — see the migration header.
//
// Run:  node scripts/espn-archive.mjs            (Node 22: `nvm use 22`)
// Cron: .github/workflows/archive.yml — needs repo secrets
//   NEXT_PUBLIC_SUPABASE_URL   (already set)
//   SUPABASE_SERVICE_ROLE_KEY  (same one the results/promos crons use)
//
// Without creds it fetches and reports, writing nothing — safe to run locally.
import { buildMatchRows, summariesToFetch, finishedCount, pickSummary } from "../src/lib/espn/archive-core.mjs";

const LEAGUE = process.env.LEAGUE || "fifa.world";
const DATES = process.env.DATES || "20260611-20260719";
const BASE = `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(LEAGUE)}`;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIVE = Boolean(SUPABASE_URL && SERVICE_ROLE);

const getJson = async (url) => {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

const rpc = async (fn, body) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      authorization: `Bearer ${SERVICE_ROLE}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${fn} failed: ${r.status} ${await r.text()}`);
};

/** Finished matches already archived — their summaries never change again. */
const storedFinishedSummaries = async () => {
  if (!LIVE) return new Set();
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/espn_summaries?select=match_id&league=eq.${encodeURIComponent(LEAGUE)}`,
    { headers: { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!r.ok) return new Set(); // first run, or the table isn't there yet
  return new Set((await r.json()).map((x) => x.match_id));
};

// ---- matches -------------------------------------------------------------
const scoreboard = await getJson(`${BASE}/scoreboard?dates=${DATES}&limit=400`);
const rows = buildMatchRows(scoreboard, LEAGUE);
if (rows.length === 0) {
  console.error("✋ ESPN returned no events — refusing to write an empty archive");
  process.exit(1);
}
if (LIVE) await rpc("set_espn_matches", { items: rows });
console.log(`${LIVE ? "✓ archived" : "(dry run)"} ${rows.length} matches (${finishedCount(rows)} finished)`);

// ---- standings -----------------------------------------------------------
// Group tables. Absent for leagues without a group phase, which is not an error.
try {
  const standings = await getJson(`${BASE}/standings`);
  if (LIVE) await rpc("set_espn_standings", { p_league: LEAGUE, p_raw: standings });
  console.log(`${LIVE ? "✓ archived" : "(dry run)"} standings`);
} catch (err) {
  console.log(`· no standings for ${LEAGUE} (${err.message})`);
}

// ---- summaries (lineups, subs) ------------------------------------------
// One request per match, so only fetch what's missing: a finished match's
// summary is immutable once stored, and pre-match ones have no lineup yet.
const stored = await storedFinishedSummaries();
const wanted = summariesToFetch(rows, stored);
const summaries = [];
for (const id of wanted) {
  try {
    // Only the slice the app parses — see pickSummary for the size argument.
    const raw = pickSummary(await getJson(`${BASE}/summary?event=${id}`));
    if (raw) summaries.push({ match_id: id, league: LEAGUE, raw });
  } catch (err) {
    console.log(`· summary ${id} unavailable (${err.message})`);
  }
}
// Chunked so one oversized request body can't fail the whole batch.
for (let i = 0; i < summaries.length; i += 20) {
  if (LIVE) await rpc("set_espn_summaries", { items: summaries.slice(i, i + 20) });
}
console.log(
  `${LIVE ? "✓ archived" : "(dry run)"} ${summaries.length} summaries` +
    ` (${stored.size} already stored, ${wanted.length} fetched)`,
);

if (!LIVE) console.log("(local; set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to write)");
