"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ARCHIVO, BRIC, JB, LIME, SAIRA } from "@/components/live/bf-ui";

/**
 * RB Store promo strip (v3 redesign): the streamer's affiliate deals from the
 * public `promos` table, lime-branded, auto-scrolling so all of them pass by. Left
 * label + right "VER TODAS →" link to the Telegram channel.
 */
const CHANNEL = "https://t.me/rbstorenet";
const POLL_MS = 4 * 60_000;
const STRIPE = "repeating-linear-gradient(135deg,#1a2a20 0 5px,#12201700 5px 10px),#15241b";

export interface Promo {
  product: string;
  price: string | null;
  link: string;
  image: string | null;
  store: string | null;
  coupon: string | null;
}

export function RbStoreStrip({ height = 64 }: { height?: number }) {
  const [fetched, setFetched] = useState<Promo[]>([]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    let alive = true;
    const load = async () => {
      const { data } = await client.from("promos").select("product,price,link,image,store,coupon").order("position");
      if (alive && data) setFetched((data as Promo[]).filter((i) => i.product && i.link));
    };
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const items = fetched;
  const loop = items.length ? [...items, ...items] : [];
  const thumb = height - 30;

  return (
    <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14, height, borderRadius: 12, border: "1px solid rgba(200,255,45,0.18)", background: "linear-gradient(180deg, rgba(200,255,45,0.05), rgba(255,255,255,0.012))", padding: "0 14px", overflow: "hidden" }}>
      <span style={{ flex: "none", fontFamily: BRIC, fontWeight: 800, fontSize: 12.5, color: "#f1f7f0", whiteSpace: "nowrap" }}>
        🎁 RB Store <span style={{ fontFamily: JB, fontSize: 9, fontWeight: 400, color: "#7d9a86", letterSpacing: "0.08em" }}>· PROMOS DO GRUPO</span>
      </span>

      <div className="promo-marquee" style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", display: "flex", alignItems: "center" }}>
        {loop.length ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, animation: `baltfutPromoScroll ${Math.max(20, items.length * 4)}s linear infinite`, willChange: "transform" }}>
            {loop.map((p, i) => (
              <a key={i} href={p.link} target="_blank" rel="noopener noreferrer" title={p.product} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8, borderRadius: 9, padding: "5px 8px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none", width: 188 }}>
                <span style={{ flex: "none", width: thumb, height: thumb, borderRadius: 7, background: p.image ? "#15241b" : STRIPE, overflow: "hidden" }}>
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" width={thumb} height={thumb} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : null}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: BRIC, fontWeight: 600, fontSize: 10, lineHeight: 1.2, color: "#eef3ee", maxHeight: 24, overflow: "hidden" }}>{p.product}</span>
                  <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                    {p.store ? <span style={{ fontFamily: ARCHIVO, fontSize: 8, letterSpacing: "0.04em", color: "#6f8a78" }}>{p.store}</span> : null}
                    {p.price ? <span style={{ fontFamily: SAIRA, fontWeight: 700, fontSize: 13, color: LIME }}>{p.price}</span> : null}
                  </span>
                </span>
              </a>
            ))}
          </div>
        ) : (
          <span style={{ fontFamily: JB, fontSize: 10, color: "#6f8a78" }}>Promoções em breve — entre nos grupos da RB Store →</span>
        )}
      </div>

      <a href={CHANNEL} target="_blank" rel="noopener noreferrer" style={{ flex: "none", fontFamily: JB, fontSize: 9, color: "#0f1f02", background: LIME, padding: "6px 11px", borderRadius: 8, fontWeight: 700, letterSpacing: "0.06em", textDecoration: "none", whiteSpace: "nowrap" }}>VER TODAS →</a>
    </div>
  );
}
