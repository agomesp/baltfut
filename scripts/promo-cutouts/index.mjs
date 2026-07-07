#!/usr/bin/env node
// Background-remove RB Store promo images and host the transparent cutouts in
// Supabase storage, then fill promos.image_cutout. The client prefers the cutout,
// rendering the product floating on the dark theme (no white card) — and since the
// Telegram telesco.pe image URLs EXPIRE, the stored cutout is also the permanent copy.
//
// Runs in the promos cron AFTER telegram-pull (set_promos preserves cutouts across a
// pull by link, so we only cut deals that don't have one yet). Kept isolated (its own
// package.json / node_modules) so the ML deps never touch the app's audit or bundle.
//
// Env:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (service_role — the only writer)
//       MAX (optional, default 25) — cap cutouts per run so the job can't run away.
// Run:  cd scripts/promo-cutouts && npm ci && node index.mjs
import { createClient } from "@supabase/supabase-js";
import { removeBackground } from "@imgly/background-removal-node";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "promo-cutouts";
const MAX = Number(process.env.MAX || 25);

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("✋ set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// Stable per-deal object key: the rbstore short code (…/s/<code>), else a link hash.
function keyFor(link) {
  const m = link.match(/\/s\/([A-Za-z0-9_]+)/);
  if (m) return `${m[1]}.png`;
  let h = 0;
  for (let i = 0; i < link.length; i++) h = (h * 31 + link.charCodeAt(i)) | 0;
  return `h${Math.abs(h)}.png`;
}

async function ensureBucket() {
  // Public bucket → the client reads the cutout via a plain public URL. Idempotent.
  const { error } = await sb.storage.createBucket(BUCKET, { public: true });
  if (error && !/exists/i.test(error.message)) throw error;
}

async function main() {
  await ensureBucket();

  // Only deals that still need a cutout and have a (fresh) source image.
  const { data: rows, error } = await sb
    .from("promos")
    .select("position,link,image,image_cutout")
    .is("image_cutout", null)
    .not("image", "is", null)
    .order("position");
  if (error) throw error;

  const todo = (rows ?? []).filter((r) => r.image).slice(0, MAX);
  console.log(`· ${todo.length} promo(s) to cut (of ${rows?.length ?? 0} uncut; MAX=${MAX})`);

  let done = 0, skipped = 0;
  for (const r of todo) {
    const key = keyFor(r.link);
    try {
      const src = await fetch(r.image);
      if (!src.ok) { console.warn(`  ⤫ ${key}: image ${src.status} (expired?) — skip`); skipped++; continue; }
      const inputBlob = await src.blob();

      const cut = await removeBackground(inputBlob);
      const buf = Buffer.from(await cut.arrayBuffer());

      const up = await sb.storage.from(BUCKET).upload(key, buf, { contentType: "image/png", upsert: true });
      if (up.error) throw up.error;

      const publicUrl = sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
      const upd = await sb.from("promos").update({ image_cutout: publicUrl }).eq("link", r.link);
      if (upd.error) throw upd.error;

      console.log(`  ✓ ${key} ← ${r.link}`);
      done++;
    } catch (e) {
      console.warn(`  ⤫ ${key}: ${e?.message || e} — skip`);
      skipped++;
    }
  }
  console.log(`✓ cut ${done}, skipped ${skipped}`);
}

main().catch((e) => { console.error("✋", e); process.exit(1); });
