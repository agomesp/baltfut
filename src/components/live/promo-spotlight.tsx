"use client";

// Stream-friendly promo view: one big RB Store deal at a time, auto-rotating with
// a progress bar, a QR of the deal's affiliate link (scan-to-buy on stream), and a
// filmstrip of what's next. Fills its container (used in the live view's palpites
// slot and standalone at /testpromos). Same feed as LivePromosPanel.
import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  fillDemoDiscounts, parsePromoFixture, safeUrl,
  PROMOS_COLUMNS, PROMOS_FIXTURE, PROMOS_TARGET, SAMPLE_PROMOS, type Promo,
} from "@/lib/promos";
import { ARCHIVO, BRIC, JB, SAIRA, LIME, GOLD, DIM, DIM_2 } from "@/components/live/bf-ui";

const STRIPE = "repeating-linear-gradient(135deg,#1a2a20 0 6px,#12201700 6px 12px),#15241b";
const ROTATE_MS = 7000;
const POLL_MS = 4 * 60_000;

const parseBRL = (s: string | null): number | null => {
  if (!s) return null;
  const n = Number(String(s).replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const formatBRL = (n: number): string => "R$ " + Math.round(n).toLocaleString("pt-BR");
/** The pre-discount price implied by the deal's % (for a struck "de R$X"). */
const originalPrice = (price: string | null, discount?: number | null): string | null => {
  const v = parseBRL(price);
  if (v == null || !discount) return null;
  return formatBRL(v / (1 - discount / 100));
};

function DiscountBurst({ pct, size = 68 }: { pct: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", background: "radial-gradient(circle at 50% 40%, #ffe14d, #ffce3a 60%, #f4b400)", color: "#241a00", boxShadow: "0 6px 20px -4px rgba(244,180,0,0.6)", flex: "none", lineHeight: 1 }}>
      <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: size * 0.42 }}>-{pct}%</span>
      <span style={{ fontFamily: JB, fontSize: size * 0.13, letterSpacing: "0.1em", marginTop: 2 }}>OFF</span>
    </span>
  );
}

/** Auto-advance progress bar. Remounted per deal (key=idx) so it restarts at 0 and
 *  drives the rotation via onComplete. Isolated so only it re-renders ~20fps. */
function AutoProgress({ speed, paused, onComplete }: { speed: number; paused: boolean; onComplete: () => void }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const id = window.setInterval(() => {
      const v = Math.min(1, (performance.now() - start) / speed);
      setP(v);
      if (v >= 1) { window.clearInterval(id); onComplete(); }
    }, 50);
    return () => window.clearInterval(id);
  }, [speed, paused, onComplete]);
  return (
    <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", flex: "none" }}>
      <div style={{ height: "100%", width: `${p * 100}%`, background: `linear-gradient(90deg, ${GOLD}, ${LIME})`, boxShadow: `0 0 10px ${LIME}88` }} />
    </div>
  );
}

function Deal({ p }: { p: Promo }) {
  const orig = originalPrice(p.price, p.discount);
  return (
    <div style={{ display: "flex", gap: 22, alignItems: "stretch", flex: 1, minHeight: 0 }}>
      {/* Product image + burst + store chip */}
      <div style={{ position: "relative", flex: "0 0 34%", borderRadius: 20, overflow: "hidden", background: p.image ? "#0e1b14" : STRIPE, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span aria-hidden style={{ fontSize: 110 }}>🎁</span>
        )}
        {p.discount != null ? <span style={{ position: "absolute", top: 14, left: 14 }}><DiscountBurst pct={p.discount} /></span> : null}
        {p.store ? <span style={{ position: "absolute", bottom: 12, left: 12, fontFamily: JB, fontSize: 11, letterSpacing: "0.06em", color: "#d7e0d4", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", padding: "5px 11px", borderRadius: 999 }}>{p.store.toUpperCase()}</span> : null}
      </div>

      {/* Deal details + CTA */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 13 }}>
        <div style={{ fontFamily: JB, fontSize: 11, letterSpacing: "0.14em", color: GOLD }}>🔥 OFERTA DO GRUPO</div>
        <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(20px,2.4vw,36px)", lineHeight: 1.05, color: "#f4f8f2", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const }}>{p.product}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          {p.price ? <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: "clamp(30px,4vw,54px)", lineHeight: 0.9, color: LIME }}>{p.price}</span> : null}
          {orig ? <span style={{ fontFamily: SAIRA, fontSize: 20, color: DIM_2, textDecoration: "line-through" }}>{orig}</span> : null}
          {p.discount != null ? <span style={{ fontFamily: JB, fontWeight: 800, fontSize: 13, color: "#241a00", background: "#ffce3a", padding: "3px 9px", borderRadius: 8 }}>-{p.discount}%</span> : null}
        </div>
        {p.coupon ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9, alignSelf: "flex-start", fontFamily: JB, fontSize: 13.5, color: "#ffe6a3", background: "rgba(255,206,58,0.1)", border: "1px dashed rgba(255,206,58,0.55)", padding: "8px 13px", borderRadius: 11 }}>
            🎟 CUPOM <b style={{ fontFamily: ARCHIVO, letterSpacing: "0.08em", color: "#fff" }}>{p.coupon}</b>
          </div>
        ) : null}
        <a href={safeUrl(p.link)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start", fontFamily: BRIC, fontWeight: 800, fontSize: 16, color: "#0f1f02", background: LIME, padding: "12px 22px", borderRadius: 12, textDecoration: "none", boxShadow: `0 0 26px -6px ${LIME}` }}>
          🛒 COMPRAR AGORA ↗
        </a>
      </div>

      {/* Scan-to-buy: the deal's affiliate link as a QR — the only way a viewer
          watching the stream can reach a long affiliate URL they can't type. */}
      <div style={{ flex: "none", alignSelf: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 9, background: "#fff", borderRadius: 16, padding: "14px 14px 11px", boxShadow: "0 12px 34px -8px rgba(0,0,0,0.55)" }}>
        <QRCodeSVG value={safeUrl(p.link)} size={132} bgColor="#ffffff" fgColor="#0a1a10" level="M" marginSize={2} />
        <span style={{ fontFamily: JB, fontSize: 9.5, letterSpacing: "0.04em", color: "#16241b", textAlign: "center", lineHeight: 1.4 }}>📷 APONTE A CÂMERA<br />pra abrir a oferta</span>
      </div>
    </div>
  );
}

function Filmstrip({ items, idx, onPick }: { items: Promo[]; idx: number; onPick: (i: number) => void }) {
  return (
    <div className="bf-scroll" style={{ display: "flex", gap: 9, overflowX: "auto", padding: "2px", flex: "none" }}>
      {items.map((p, i) => {
        const on = i === idx;
        return (
          <button key={i} type="button" onClick={() => onPick(i)} aria-label={p.product} style={{ position: "relative", flex: "none", width: on ? 82 : 66, height: on ? 82 : 66, borderRadius: 12, overflow: "hidden", cursor: "pointer", padding: 0, background: p.image ? "#0e1b14" : STRIPE, border: on ? `2px solid ${LIME}` : "1px solid rgba(255,255,255,0.09)", transition: "width .25s, height .25s", boxShadow: on ? `0 0 16px -3px ${LIME}aa` : "none" }}>
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: on ? 1 : 0.62 }} />
            ) : (
              <span aria-hidden style={{ fontSize: on ? 30 : 24 }}>🎁</span>
            )}
            {p.discount != null ? <span style={{ position: "absolute", top: 0, left: 0, fontFamily: JB, fontWeight: 800, fontSize: 9, color: "#241a00", background: "#ffce3a", padding: "2px 5px", borderRadius: "12px 0 7px 0" }}>-{p.discount}%</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function PromoSpotlight() {
  const [fetched, setFetched] = useState<Promo[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  // Same source as the live promo panel: Supabase (polled) → telegram fixture → samples.
  useEffect(() => {
    const client = getSupabaseClient();
    let alive = true;
    const loadSupabase = async () => {
      if (!client) return false;
      const { data } = await client.from("promos").select(PROMOS_COLUMNS).order("position").limit(PROMOS_TARGET);
      if (alive && data?.length) { setFetched((data as Promo[]).filter((i) => i.product && i.link)); return true; }
      return false;
    };
    const loadFixture = async () => {
      try {
        const res = await fetch(PROMOS_FIXTURE, { cache: "no-store" });
        if (res.ok) { const p = fillDemoDiscounts(parsePromoFixture(await res.json())); if (alive && p.length) setFetched(p); }
      } catch { /* fall back to samples */ }
    };
    if (client) {
      void loadSupabase();
      const id = window.setInterval(() => void loadSupabase(), POLL_MS);
      return () => { alive = false; window.clearInterval(id); };
    }
    void loadFixture();
    return () => { alive = false; };
  }, []);

  const items = useMemo(() => fillDemoDiscounts(fetched.length ? fetched : SAMPLE_PROMOS), [fetched]);
  const n = items.length;
  const safeIdx = n ? idx % n : 0;
  const current = items[safeIdx];
  const advance = useCallback(() => setIdx((i) => (n ? (i + 1) % n : 0)), [n]);

  if (!current) return null;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 11 }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, flex: "none" }}>
        <span style={{ fontFamily: ARCHIVO, fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em", color: "#eef3ea" }}>🎁 OFERTAS DO GRUPO</span>
        <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.1em", color: GOLD, border: `1px solid ${GOLD}55`, padding: "2px 8px", borderRadius: 999 }}>RB STORE</span>
        <span style={{ fontFamily: JB, fontSize: 10, color: DIM }}>{n} ofertas · gira sozinho</span>
      </div>

      {/* Spotlight */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12, borderRadius: 18, border: "1px solid rgba(200,255,45,0.14)", background: "linear-gradient(180deg, rgba(20,38,26,0.5), rgba(10,20,13,0.5))", padding: 18 }}>
        <Deal p={current} />
        <AutoProgress key={safeIdx} speed={ROTATE_MS} paused={paused} onComplete={advance} />
      </div>

      <Filmstrip items={items} idx={safeIdx} onPick={setIdx} />
    </div>
  );
}
