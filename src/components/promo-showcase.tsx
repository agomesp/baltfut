"use client";

import { useEffect, useState } from "react";
import { Gift, ArrowRight } from "lucide-react";
import { MONO } from "@/components/primitives";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Slim promo bar that sits on top of the live score. Latest deals from the public
 * RB Store Telegram channel (public/promos.json, by scripts/telegram-pull.mjs):
 * product image, price, store — each card links to its deal, and the whole row
 * auto-scrolls (PiP-style marquee, track duplicated so it loops seamlessly) so all
 * ~10 keep moving past. Left CTA links to the channel.
 *
 * SECURITY: only string fields are rendered (React escapes them); images come from
 * Telegram's CDN — no raw markup from messages is injected.
 */
const CHANNEL = "https://t.me/rbstorenet";
const POLL_MS = 4 * 60_000; // re-read the feed every 4 min (no deploy needed)

interface Promo {
  product: string;
  price: string | null;
  link: string;
  image: string | null;
  store: string | null;
  coupon: string | null;
}

export function PromoShowcase({ height = 60 }: { height?: number }) {
  const [items, setItems] = useState<Promo[]>([]);

  // Poll the Supabase `promos` table so the cron can refresh the feed WITHOUT a
  // Pages deploy / viewer reload — new deals just appear on the next poll.
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    let alive = true;
    const load = async () => {
      const { data } = await client.from("promos").select("product,price,link,image,store,coupon").order("position");
      if (alive && data) setItems((data as Promo[]).filter((i) => i.product && i.link));
    };
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const loop = items.length ? [...items, ...items] : [];
  const img = height - 22;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        height,
        marginBottom: 12,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid var(--line-2)",
        background: "var(--surface)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.28)",
      }}
    >
      {/* Left CTA → channel (replaces the old RB STORE button) */}
      <a
        href={CHANNEL}
        target="_blank"
        rel="noopener noreferrer"
        title="Veja mais promos nos grupos da RB Store"
        style={{
          flex: "0 0 auto",
          width: 196,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 3,
          padding: "0 14px",
          color: "#fff",
          textDecoration: "none",
          background: "linear-gradient(135deg, #3b82f6, #6366f1)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" }}>
          <Gift size={14} /> RB STORE
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.03em", lineHeight: 1.2, textTransform: "uppercase" }}>
          Veja mais promos no grupo <ArrowRight size={11} />
        </span>
      </a>

      {/* Auto-scrolling marquee → each card links to its deal */}
      <div className="promo-marquee" style={{ flex: "1 1 auto", overflow: "hidden", display: "flex", alignItems: "center" }}>
        {loop.length ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              animation: `baltfutPromoScroll ${Math.max(20, items.length * 4)}s linear infinite`,
              willChange: "transform",
            }}
          >
            {loop.map((p, i) => (
              <a
                key={i}
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                title={p.product}
                style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8, padding: "0 14px", height: height - 18, borderRight: "1px solid var(--line)", textDecoration: "none", color: "inherit" }}
              >
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt=""
                    width={img}
                    height={img}
                    loading="lazy"
                    style={{ width: img, height: img, objectFit: "cover", borderRadius: 6, background: "var(--bg)", flex: "0 0 auto" }}
                  />
                ) : null}
                <span style={{ display: "flex", flexDirection: "column", gap: 1, maxWidth: 210 }}>
                  <span style={{ fontSize: 11, color: "var(--ink)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 210 }}>
                    {p.product}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                    {p.store ? <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>{p.store}</span> : null}
                    {p.price ? <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: "var(--signal-strong)" }}>{p.price}</span> : null}
                  </span>
                </span>
              </a>
            ))}
          </div>
        ) : (
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--ink-3)", padding: "0 14px" }}>
            Promoções em breve — entre nos grupos da RB Store →
          </span>
        )}
      </div>
    </div>
  );
}
