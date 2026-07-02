"use client";

import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fillDemoDiscounts, padPromos, parsePromoFixture, safeUrl, PROMOS_COLUMNS, PROMOS_FIXTURE, PROMOS_TARGET, type Promo } from "@/lib/promos";
import { ARCHIVO, BRIC, JB, LIME, SAIRA } from "@/components/live/bf-ui";

const CHANNEL = "https://t.me/rbstorenet";
const POLL_MS = 4 * 60_000;
const STRIPE = "repeating-linear-gradient(135deg,#1a2a20 0 6px,#12201700 6px 12px),#15241b";
// Static green glow (matches the goal-chip #3ee65f) — a rim + soft halo. Replaces
// the animated bf-evt travelling beam so 50 cards cost ~0 continuous CPU.
const GLOW = {
  border: "1px solid rgba(62,230,95,0.38)",
  boxShadow: "0 0 15px -1px rgba(62,230,95,0.33)",
} as const;

/** Product image (or striped placeholder) at a given square size, with a yellow
 *  discount tag pinned to the top-left when the deal carries a `discount`. */
function PromoImage({ p, size }: { p: Promo; size: number }) {
  const big = size > 140;
  return (
    <span style={{ position: "relative", flex: "none", width: size, height: size, borderRadius: big ? 18 : 14, background: p.image ? "#15241b" : STRIPE, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {p.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span aria-hidden style={{ fontSize: Math.round(size * 0.38) }}>🎁</span>
      )}
      {p.discount != null ? (
        <span
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            fontFamily: JB,
            fontWeight: 800,
            fontSize: big ? 14 : 11,
            letterSpacing: "0.01em",
            color: "#1a1400",
            background: "#ffce3a",
            padding: big ? "5px 11px" : "3px 8px",
            borderRadius: `${big ? 18 : 14}px 0 ${big ? 12 : 9}px 0`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          -{p.discount}%
        </span>
      ) : null}
    </span>
  );
}

/**
 * Big, clear promo board shown on the live page in place of the palpites while the
 * streamer flips "promos" on (from the Modo Streamer PiP button). A scrollable grid
 * of RB Store deals — always filled to {@link PROMOS_TARGET} so it reads as a full,
 * scrollable set even when the live feed is short.
 *
 * SECURITY: rendered with React (auto-escaped); links are http(s)-checked and
 * images load with no referrer.
 */
export function LivePromosPanel() {
  const [fetched, setFetched] = useState<Promo[]>([]);
  const [expanded, setExpanded] = useState<Promo | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    let alive = true;
    // With Supabase (prod) → live `promos` table. Without creds (local dev) → the
    // real deals baked into public/promos.json by scripts/telegram-pull.mjs.
    const loadSupabase = async () => {
      if (!client) return;
      const { data } = await client
        .from("promos")
        .select(PROMOS_COLUMNS)
        .order("position")
        .limit(PROMOS_TARGET);
      if (alive && data) setFetched((data as Promo[]).filter((i) => i.product && i.link));
    };
    const loadFixture = async () => {
      try {
        const res = await fetch(PROMOS_FIXTURE, { cache: "no-store" });
        if (!res.ok) return;
        // Demo-fill discounts so the offer tag shows on every card locally.
        const promos = fillDemoDiscounts(parsePromoFixture(await res.json()));
        if (alive && promos.length) setFetched(promos);
      } catch {
        /* keep the sample deals */
      }
    };
    if (client) {
      void loadSupabase();
      const id = window.setInterval(() => void loadSupabase(), POLL_MS);
      return () => {
        alive = false;
        window.clearInterval(id);
      };
    }
    void loadFixture();
    return () => {
      alive = false;
    };
  }, []);

  const items = padPromos(fetched, PROMOS_TARGET);

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        border: "1px solid rgba(200,255,45,0.22)",
        background: "linear-gradient(180deg, rgba(200,255,45,0.05), rgba(255,255,255,0.012))",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "13px 18px",
          borderBottom: "1px solid rgba(200,255,45,0.16)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em", color: "#f1f7f0" }}>
            🎁 RB Store
          </span>
          <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9bb6a6" }}>
            Promos do grupo · {items.length} ofertas
          </span>
        </span>
        <a
          href={CHANNEL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ flex: "none", fontFamily: JB, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#0f1f02", background: LIME, padding: "7px 13px", borderRadius: 8, textDecoration: "none", whiteSpace: "nowrap" }}
        >
          VER TODAS →
        </a>
      </div>

      {/* Scrollable grid of deals */}
      <div
        className="bf-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(380px, 100%), 1fr))",
          gap: 16,
          alignContent: "start",
        }}
      >
        {items.map((p, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.03)", ...GLOW }}
          >
            <a
              href={safeUrl(p.link)}
              target="_blank"
              rel="noopener noreferrer"
              title={p.product}
              style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 0, textDecoration: "none" }}
            >
              <PromoImage p={p} size={104} />
              <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                <span style={{ fontFamily: BRIC, fontWeight: 600, fontSize: 20, lineHeight: 1.22, color: "#eef3ee", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {p.product}
                </span>
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  {p.store ? <span style={{ fontFamily: ARCHIVO, fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6f8a78" }}>{p.store}</span> : null}
                  {p.price ? <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 32, lineHeight: 0.9, color: LIME }}>{p.price}</span> : null}
                  {p.coupon ? <span style={{ fontFamily: JB, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "#e8b53a", border: "1px dashed #e8b53a", borderRadius: 7, padding: "3px 9px" }}>cupom {p.coupon}</span> : null}
                </span>
              </span>
            </a>
            <button
              type="button"
              onClick={() => setExpanded(p)}
              title="Ampliar oferta"
              aria-label="Ampliar oferta"
              style={{ flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 11, border: "1px solid rgba(200,255,45,0.3)", background: "rgba(200,255,45,0.07)", color: LIME, cursor: "pointer" }}
            >
              <Maximize2 size={17} />
            </button>
          </div>
        ))}
      </div>

      {/* Expanded single-deal view — the streamer's "feature one promo" screen. */}
      {expanded ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "absolute", inset: 0, zIndex: 6, display: "flex", flexDirection: "column", background: "linear-gradient(180deg, rgba(6,12,8,0.97), rgba(6,12,8,0.99))" }}
        >
          <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", borderBottom: "1px solid rgba(200,255,45,0.16)" }}>
            <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9bb6a6" }}>Oferta em destaque</span>
            <button
              type="button"
              onClick={() => setExpanded(null)}
              aria-label="Fechar"
              title="Fechar"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: JB, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#cfe3d6", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}
            >
              <X size={14} /> Fechar
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", padding: 24 }}>
            <div style={{ width: "min(560px, 100%)", margin: "auto", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 15, padding: "26px 26px", borderRadius: 20, background: "rgba(255,255,255,0.03)", ...GLOW }}>
              <PromoImage p={expanded} size={172} />
              <div style={{ fontFamily: BRIC, fontWeight: 700, fontSize: 22, lineHeight: 1.2, color: "#f1f7f0", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{expanded.product}</div>
              <div style={{ display: "inline-flex", alignItems: "baseline", justifyContent: "center", flexWrap: "wrap", gap: 14 }}>
                {expanded.store ? <span style={{ fontFamily: ARCHIVO, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#7d9a86" }}>{expanded.store}</span> : null}
                {expanded.price ? <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 46, lineHeight: 0.9, color: LIME }}>{expanded.price}</span> : null}
              </div>
              {expanded.coupon ? <span style={{ fontFamily: JB, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", color: "#e8b53a", border: "1px dashed #e8b53a", borderRadius: 9, padding: "6px 14px" }}>cupom {expanded.coupon}</span> : null}
              <a href={safeUrl(expanded.link)} target="_blank" rel="noopener noreferrer" style={{ marginTop: 4, fontFamily: JB, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "#0f1f02", background: LIME, padding: "12px 26px", borderRadius: 10, textDecoration: "none" }}>
                VER OFERTA →
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
