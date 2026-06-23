#!/usr/bin/env node
// Pull the latest promos from the PUBLIC Telegram channel (no bot/auth/secrets)
// and write public/promos.json for the page to render.
//
// Run:  node scripts/telegram-pull.mjs            (Node 22: `nvm use 22`)
//       CHANNEL=rbstorenet LIMIT=10 node scripts/telegram-pull.mjs
//
// CORS note: the browser can't fetch t.me directly, so this runs server-side
// (locally now; a no-secret GitHub Action cron or tiny endpoint later) and emits
// a static JSON the static page can read. See docs/telegram-spike.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function parse(htmlDoc) {
  // One chunk per message bubble.
  const chunks = htmlDoc.split(/tgme_widget_message_wrap/).slice(1);
  const out = [];
  for (const c of chunks) {
    const textM = c.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/);
    if (!textM) continue;
    const text = decode(textM[1]).replace(/ /g, " ").trim();
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
  return out.reverse().filter((i) => !seen.has(i.link) && seen.add(i.link)).slice(0, LIMIT);
}

const res = await fetch(`https://t.me/s/${CHANNEL}`, { headers: { "user-agent": "Mozilla/5.0 baltfut-promos" } });
if (!res.ok) { console.error(`✋ t.me returned ${res.status}`); process.exit(1); }
const items = parse(await res.text());
const payload = { channel: CHANNEL, url: `https://t.me/${CHANNEL}`, fetchedAt: new Date().toISOString(), items };
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
console.log(`✓ wrote ${items.length} promos → ${path.relative(process.cwd(), OUT)}`);
for (const i of items.slice(0, 5)) console.log(`  · ${i.store ?? "?"} — ${i.product?.slice(0, 48)} — ${i.price ?? "?"}${i.image ? " [img]" : ""}`);
