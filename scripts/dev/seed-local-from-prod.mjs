#!/usr/bin/env node
/**
 * Populate the LOCAL Supabase stack with a snapshot of PROD's public data
 * (palpites + promos), so local dev visualizes real games/palpites/results.
 *
 * Safe by construction:
 *   - Pull is READ-ONLY over the public anon read-views (`vote_entries`,
 *     `promos`) using the PUBLIC anon key — it never writes to prod and never
 *     needs a prod secret. `ip_hash` is never exposed to anon, so we synthesize
 *     a deterministic per-row hash locally (it's never surfaced anyway).
 *   - The seed TRUNCATEs + re-inserts the LOCAL `votes`/`promos` tables only.
 *
 * Prereqs: `npx supabase start` running, Docker available.
 *
 * Usage:
 *   node scripts/dev/seed-local-from-prod.mjs
 *
 * Optional env overrides:
 *   BALTFUT_PROD_URL       (default https://ymcmpeplmvhbfwqyrloc.supabase.co)
 *   BALTFUT_PROD_ANON_KEY  (default: scraped from the deployed Pages bundle)
 *   BALTFUT_DB_CONTAINER   (default supabase_db_baltfut)
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const PROD_URL = process.env.BALTFUT_PROD_URL || "https://ymcmpeplmvhbfwqyrloc.supabase.co";
const SITE = "https://agomesp.github.io/baltfut";
const DB = process.env.BALTFUT_DB_CONTAINER || "supabase_db_baltfut";

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

const dollar = (s) => `$$${s}$$`; // dollar-quote: no escaping needed for usernames/text
const val = (v) => (v == null ? "null" : dollar(v));
const ipHash = (u, m) => createHash("sha256").update(`localseed|${u}|${m}`).digest("hex");

const anonKey = process.env.BALTFUT_PROD_ANON_KEY || (await scrapeAnonKey());
console.log(`prod ${PROD_URL}  anon ${anonKey.slice(0, 18)}…`);

const votes = await pullAll("vote_entries?select=*", anonKey);
const promos = await pullAll("promos?select=*", anonKey);
console.log(`pulled ${votes.length} votes, ${promos.length} promos`);

let sql = "begin;\ntruncate table public.votes;\n";
if (votes.length) {
  sql += "insert into public.votes (match_id, league, username, pred_home, pred_away, ip_hash, created_at) values\n";
  sql += votes
    .map((v) => `(${dollar(v.match_id)}, ${dollar(v.league)}, ${dollar(v.username)}, ${v.pred_home}, ${v.pred_away}, ${dollar(ipHash(v.username, v.match_id))}, ${dollar(v.created_at)})`)
    .join(",\n") + ";\n";
}
sql += "truncate table public.promos;\n";
if (promos.length) {
  sql += "insert into public.promos (position, product, price, link, image, store, coupon, updated_at) values\n";
  sql += promos
    .map((p) => `(${p.position}, ${val(p.product)}, ${val(p.price)}, ${val(p.link)}, ${val(p.image)}, ${val(p.store)}, ${val(p.coupon)}, ${val(p.updated_at)})`)
    .join(",\n") + ";\n";
}
sql += "commit;\n";

execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
  input: sql,
  stdio: ["pipe", "inherit", "inherit"],
});
console.log(`✓ seeded local DB (${DB}): ${votes.length} votes + ${promos.length} promos`);
