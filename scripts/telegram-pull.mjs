#!/usr/bin/env node
// Pull the latest promos from the PUBLIC Telegram channel (no bot/auth/secrets) and
// push them to Supabase via the set_promos RPC (with creds) or write public/promos.json
// (local, no creds). set_promos REPLACES the whole set, so a full re-pull is idempotent.
//
// Run (CLI / GitHub cron):  node scripts/telegram-pull.mjs
//   CHANNEL=rbstorenet LIMIT=10 node scripts/telegram-pull.mjs
//
// EXPORTED for reuse (the baltfut-admin Telegram watcher pushes new posts in real time):
//   scrapeChannel({channel,limit}) → items[]   — fetch + parse only (cheap; use to diff)
//   writePromos(items, {supabaseUrl,serviceRole,out,channel}) — set_promos, or the JSON file
//   pullPromos(opts) → items[]                  — scrapeChannel + writePromos (idempotent)
// Creds default to process.env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) for the cron;
// callers (the bot) can pass them explicitly.
//
// CORS note: the browser can't fetch t.me directly, so this runs server-side and the
// static page reads the resulting Supabase rows (or the JSON). See docs/telegram-spike.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CHANNEL = process.env.CHANNEL || "rbstorenet";
const LIMIT = Number(process.env.LIMIT || 10);
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "promos.json");
const STORES = ["Shopee", "Amazon", "Mercado Livre", "AliExpress", "Magalu", "Magazine Luiza", "Kabum", "Casas Bahia", "Pichau", "Terabyte"];

function decode(s) {
  return s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))) // hex entities
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))) // decimal entities (e.g. &#036; → $)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");
}

function parse(htmlDoc, limit = LIMIT) {
  // One chunk per message bubble.
  const chunks = htmlDoc.split(/tgme_widget_message_wrap/).slice(1);
  const out = [];
  for (const c of chunks) {
    const textM = c.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/);
    if (!textM) continue;
    const text = decode(textM[1]).replace(/ /g, " ").trim();
    const imgM = c.match(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/);
    const dateM = c.match(/datetime="([^"]+)"/);
    const link = (text.match(/https?:\/\/rbstore\.net\/\S+/) || [])[0] || null;
    let price = (text.match(/R\$\s*[\d.]+,\d{2}/) || [])[0]?.replace(/\s+/g, " ") || null;
    if (price && /R\$ ?0,00$/.test(price)) price = null; // placeholder "R$ 0,00" = no price set
    const product = (text.match(/✅\s*(.+)/) || [, null])[1]?.trim() || text.split("\n")[0]?.trim();
    const store = STORES.find((s) => text.toLowerCase().includes(s.toLowerCase())) || null;
    const coupon = (text.match(/Cupom\s+([A-Z0-9]{3,})/i) || [, null])[1] || null;
    if (!product || !link) continue; // need at least a product + a buyable link
    out.push({
      product: product.slice(0, 90),
      price,
      link,
      image: imgM ? imgM[1] : null,
      store,
      coupon,
      date: dateM ? dateM[1] : null,
    });
  }
  // Newest last in the page → reverse to newest-first, dedupe by link, cap.
  const seen = new Set();
  return out.reverse().filter((i) => !seen.has(i.link) && seen.add(i.link)).slice(0, limit);
}

/** Fetch + parse the public channel → newest-first deals with a `position`. No write. */
export async function scrapeChannel({ channel = CHANNEL, limit = LIMIT } = {}) {
  const res = await fetch(`https://t.me/s/${channel}`, { headers: { "user-agent": "Mozilla/5.0 baltfut-promos" } });
  if (!res.ok) throw new Error(`t.me returned ${res.status}`);
  const parsed = parse(await res.text(), limit);
  return parsed.map((it, i) => ({ position: i, ...it }));
}

/**
 * Replace the promos set: the set_promos RPC when Supabase creds are present (the cron
 * and the bot), else write the local JSON file. Returns { target, count }.
 */
export async function writePromos(items, {
  supabaseUrl = process.env.SUPABASE_URL,
  serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY,
  out = OUT,
  channel = CHANNEL,
} = {}) {
  if (supabaseUrl && serviceRole) {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/set_promos`, {
      method: "POST",
      headers: { apikey: serviceRole, authorization: `Bearer ${serviceRole}`, "content-type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error(`set_promos failed: ${res.status} ${await res.text()}`);
    return { target: "supabase", count: items.length };
  }
  fs.writeFileSync(out, JSON.stringify({ channel, url: `https://t.me/${channel}`, fetchedAt: new Date().toISOString(), items }, null, 2) + "\n");
  return { target: "file", count: items.length, out };
}

/** Full pull: scrape the channel + replace the set. Idempotent. Returns the items. */
export async function pullPromos(opts = {}) {
  const items = await scrapeChannel(opts);
  await writePromos(items, opts);
  return items;
}

// CLI / cron entrypoint (node scripts/telegram-pull.mjs) — unchanged behavior/output.
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    const items = await scrapeChannel();
    const result = await writePromos(items);
    if (result.target === "supabase") {
      console.log(`✓ upserted ${result.count} promos → Supabase (no deploy, no reload)`);
    } else {
      console.log(`✓ wrote ${result.count} promos → ${path.relative(process.cwd(), result.out)} (local; set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to upsert to the DB)`);
    }
    for (const i of items.slice(0, 5)) console.log(`  · ${i.store ?? "?"} — ${i.product?.slice(0, 48)} — ${i.price ?? "?"}${i.image ? " [img]" : ""}`);
  } catch (e) {
    console.error(`✋ ${e.message}`);
    process.exit(1);
  }
}
