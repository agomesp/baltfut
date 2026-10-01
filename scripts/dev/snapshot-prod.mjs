#!/usr/bin/env node
/**
 * Refresh the LOCAL prod-mirror snapshot (`public/dev/prod-snapshot.json`) from
 * PROD's public read-views. This is the "sync local with prod" step.
 *
 * One-way + safe by construction:
 *   - READ-ONLY: pulls `vote_entries` + `promos` over the PUBLIC anon key (the
 *     same key shipped in the deployed bundle). It never writes to prod and
 *     never needs a prod secret.
 *   - Output is a flat JSON file the app loads when `NEXT_PUBLIC_DEV_FIXTURE=1`
 *     (see src/lib/dev-fixture.ts). Nothing local can write back to prod.
 *
 * Usage:
 *   node scripts/dev/snapshot-prod.mjs
 *
 * Optional env overrides:
 *   BALTFUT_PROD_URL       (default https://ymcmpeplmvhbfwqyrloc.supabase.co)
 *   BALTFUT_PROD_ANON_KEY  (default: scraped from the deployed Pages bundle)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROD_URL = process.env.BALTFUT_PROD_URL || "https://ymcmpeplmvhbfwqyrloc.supabase.co";
const SITE = "https://agomesp.github.io/baltfut";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/dev/prod-snapshot.json");

/** The anon key is PUBLIC (inlined in the deployed static bundle); scrape it. */
async function scrapeAnonKey() {
  const idx = await (await fetch(`${SITE}/`)).text();
  const chunks = [...new Set([...idx.matchAll(/\/baltfut\/_next\/static\/[^"]+\.js/g)].map((m) => m[0]))];
  for (const c of chunks) {
    const js = await (await fetch(`https://agomesp.github.io${c}`)).text();
    const m = js.match(/sb_publishable_[A-Za-z0-9_]+/);
    if (m) return m[0];
  }
  throw new Error("anon key not found in the deployed bundle — set BALTFUT_PROD_ANON_KEY");
}

/** Read a public view fully, paging past PostgREST's 1000-row cap. */
async function pullAll(base, key) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${PROD_URL}/rest/v1/${base}&limit=1000&offset=${offset}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`pull ${base} failed: ${res.status} ${await res.text()}`);
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

const anonKey = process.env.BALTFUT_PROD_ANON_KEY || (await scrapeAnonKey());
console.log(`prod ${PROD_URL}  anon ${anonKey.slice(0, 18)}…`);

const rawVotes = await pullAll("vote_entries?select=*", anonKey);
const rawPromos = await pullAll("promos?select=*", anonKey);

// Map prod rows to the app's client-side shapes (the app reads these verbatim).
const voteEntries = rawVotes.map((v) => ({
  matchId: v.match_id,
  league: v.league,
  username: v.username,
  predHome: v.pred_home,
  predAway: v.pred_away,
  penWinner: v.pen_winner ?? null,
  createdAt: v.created_at,
}));
const promos = rawPromos.map((p) => ({
  product: p.product,
  price: p.price ?? null,
  link: p.link,
  image: p.image ?? null,
  store: p.store ?? null,
  coupon: p.coupon ?? null,
  position: p.position,
}));

const snapshot = {
  generatedAt: new Date().toISOString(),
  source: "prod (read-only)",
  voteEntries,
  promos,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`✓ wrote ${OUT}: ${voteEntries.length} votes + ${promos.length} promos`);
