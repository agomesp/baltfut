"use client";

// PROTOTYPE — /testpromos. A stream-friendly "Promo Spotlight": one big RB Store
// deal on screen at a time, auto-rotating with a progress bar + a filmstrip of
// what's next. The idea vs the current 50-card grid: readable at stream res,
// self-playing (no clicking mid-match), and it foregrounds each affiliate link.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, ExternalLink, Ticket } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  fillDemoDiscounts, parsePromoFixture, safeUrl,
  PROMOS_COLUMNS, PROMOS_FIXTURE, PROMOS_TARGET, SAMPLE_PROMOS, type Promo,
} from "@/lib/promos";
import { ARCHIVO, BRIC, JB, SAIRA, LIME, GOLD, DIM, DIM_2 } from "@/components/live/bf-ui";

const STRIPE = "repeating-linear-gradient(135deg,#1a2a20 0 6px,#12201700 6px 12px),#15241b";

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

function DiscountBurst({ pct, size = 74 }: { pct: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", background: "radial-gradient(circle at 50% 40%, #ffe14d, #ffce3a 60%, #f4b400)", color: "#241a00", boxShadow: "0 6px 20px -4px rgba(244,180,0,0.6)", flex: "none", lineHeight: 1 }}>
      <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: size * 0.42 }}>-{pct}%</span>
      <span style={{ fontFamily: JB, fontSize: size * 0.13, letterSpacing: "0.1em", marginTop: 2 }}>OFF</span>
    </span>
  );
}

/** The auto-advance progress bar. Remounted per deal (key=idx) so it restarts at 0
 *  and drives the rotation via onComplete. Isolated so only it re-renders ~20fps. */
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
    <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${p * 100}%`, background: `linear-gradient(90deg, ${GOLD}, ${LIME})`, boxShadow: `0 0 10px ${LIME}88` }} />
    </div>
  );
}

function Spotlight({ p }: { p: Promo }) {
  const orig = originalPrice(p.price, p.discount);
  return (
    <div style={{ display: "flex", gap: 26, alignItems: "stretch", flex: 1, minHeight: 0 }}>
      {/* Product image + burst + store chip */}
      <div style={{ position: "relative", flex: "0 0 44%", borderRadius: 22, overflow: "hidden", background: p.image ? "#0e1b14" : STRIPE, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span aria-hidden style={{ fontSize: 130 }}>🎁</span>
        )}
        {p.discount != null ? (
          <span style={{ position: "absolute", top: 18, left: 18 }}><DiscountBurst pct={p.discount} /></span>
        ) : null}
        {p.store ? (
          <span style={{ position: "absolute", bottom: 16, left: 16, fontFamily: JB, fontSize: 12, letterSpacing: "0.06em", color: "#d7e0d4", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", padding: "6px 12px", borderRadius: 999 }}>{p.store.toUpperCase()}</span>
        ) : null}
      </div>

      {/* Deal details + CTA */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
        <div style={{ fontFamily: JB, fontSize: 12, letterSpacing: "0.14em", color: GOLD }}>🔥 OFERTA DO GRUPO</div>
        <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(26px,3vw,42px)", lineHeight: 1.05, color: "#f4f8f2" }}>{p.product}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          {p.price ? <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: "clamp(38px,5vw,64px)", lineHeight: 0.9, color: LIME }}>{p.price}</span> : null}
          {orig ? <span style={{ fontFamily: SAIRA, fontSize: 24, color: DIM_2, textDecoration: "line-through" }}>{orig}</span> : null}
          {p.discount != null ? <span style={{ fontFamily: JB, fontWeight: 800, fontSize: 14, color: "#241a00", background: "#ffce3a", padding: "4px 10px", borderRadius: 8 }}>-{p.discount}%</span> : null}
        </div>
        {p.coupon ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, alignSelf: "flex-start", fontFamily: JB, fontSize: 15, color: "#ffe6a3", background: "rgba(255,206,58,0.1)", border: "1px dashed rgba(255,206,58,0.55)", padding: "9px 15px", borderRadius: 12 }}>
            <Ticket size={17} /> CUPOM <b style={{ fontFamily: ARCHIVO, letterSpacing: "0.08em", color: "#fff" }}>{p.coupon}</b>
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
          <a href={safeUrl(p.link)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: BRIC, fontWeight: 800, fontSize: 17, color: "#0f1f02", background: LIME, padding: "13px 24px", borderRadius: 12, textDecoration: "none", boxShadow: `0 0 26px -6px ${LIME}` }}>
            🛒 COMPRAR AGORA <ExternalLink size={17} />
          </a>
          <span style={{ fontFamily: JB, fontSize: 12.5, color: DIM }}>ou no grupo → <b style={{ color: "#cfe8c0" }}>t.me/rbstorenet</b></span>
        </div>
      </div>
    </div>
  );
}

function Filmstrip({ items, idx, onPick }: { items: Promo[]; idx: number; onPick: (i: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "4px 2px" }} className="bf-scroll">
      {items.map((p, i) => {
        const on = i === idx;
        return (
          <button key={i} type="button" onClick={() => onPick(i)} style={{ position: "relative", flex: "none", width: on ? 96 : 76, height: on ? 96 : 76, borderRadius: 14, overflow: "hidden", cursor: "pointer", padding: 0, background: p.image ? "#0e1b14" : STRIPE, border: on ? `2px solid ${LIME}` : "1px solid rgba(255,255,255,0.09)", transition: "width .25s, height .25s", boxShadow: on ? `0 0 16px -3px ${LIME}aa` : "none" }}>
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: on ? 1 : 0.62 }} />
          ) : (
            <span aria-hidden style={{ fontSize: on ? 34 : 26 }}>🎁</span>
          )}
          {p.discount != null ? (
            <span style={{ position: "absolute", top: 0, left: 0, fontFamily: JB, fontWeight: 800, fontSize: 9.5, color: "#241a00", background: "#ffce3a", padding: "2px 6px", borderRadius: "12px 0 8px 0" }}>-{p.discount}%</span>
          ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default function TestPromosPage() {
  const [fetched, setFetched] = useState<Promo[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(7000);

  // Same source as the live promo panel: Supabase → telegram fixture → samples.
  useEffect(() => {
    const client = getSupabaseClient();
    let alive = true;
    (async () => {
      if (client) {
        const { data } = await client.from("promos").select(PROMOS_COLUMNS).order("position").limit(PROMOS_TARGET);
        if (alive && data?.length) { setFetched((data as Promo[]).filter((i) => i.product && i.link)); return; }
      }
      try {
        const res = await fetch(PROMOS_FIXTURE, { cache: "no-store" });
        if (res.ok) { const p = fillDemoDiscounts(parsePromoFixture(await res.json())); if (alive && p.length) setFetched(p); }
      } catch { /* fall back to samples */ }
    })();
    return () => { alive = false; };
  }, []);

  const items = useMemo(() => {
    const base = fetched.length ? fetched : SAMPLE_PROMOS;
    return fillDemoDiscounts(base);
  }, [fetched]);
  const n = items.length;
  const current = items[idx % Math.max(1, n)] ?? items[0];
  const advance = useCallback(() => setIdx((i) => (n ? (i + 1) % n : 0)), [n]);
  const go = (delta: number) => setIdx((i) => (n ? (i + delta + n) % n : 0));

  if (!current) return null;

  const btn = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)", color: "#dfeada", cursor: "pointer" } as const;

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(1200px 700px at 50% -10%, #14311f, #081109 70%)", color: "#eef3ea", padding: "20px 26px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: ARCHIVO, fontWeight: 800, fontSize: 22, letterSpacing: "-0.01em" }}>🎁 OFERTAS DO GRUPO</span>
        <span style={{ fontFamily: JB, fontSize: 11, letterSpacing: "0.1em", color: GOLD, border: `1px solid ${GOLD}55`, padding: "3px 9px", borderRadius: 999 }}>RB STORE</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: JB, fontSize: 11, color: "#ff8f8f" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d", animation: "bfpulse 1.5s infinite" }} /> AO VIVO
        </span>
        <span style={{ fontFamily: JB, fontSize: 11, color: DIM }}>{n} ofertas · rodando sozinho</span>
        <span style={{ marginLeft: "auto", fontFamily: JB, fontSize: 10, color: DIM_2 }}>PROTÓTIPO · /testpromos</span>
      </header>

      {/* Spotlight card */}
      <section style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 14, borderRadius: 24, border: "1px solid rgba(200,255,45,0.14)", background: "linear-gradient(180deg, rgba(20,38,26,0.6), rgba(10,20,13,0.6))", boxShadow: "0 24px 60px -20px rgba(0,0,0,0.7)", padding: 26 }}>
        <Spotlight p={current} />
        <AutoProgress key={idx} speed={speed} paused={paused} onComplete={advance} />
      </section>

      {/* Filmstrip */}
      <Filmstrip items={items} idx={idx % Math.max(1, n)} onPick={setIdx} />

      {/* Controls (prototype) */}
      <footer style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button type="button" aria-label="anterior" style={btn} onClick={() => go(-1)}><ChevronLeft size={20} /></button>
        <button type="button" aria-label={paused ? "play" : "pause"} style={{ ...btn, background: paused ? LIME : "rgba(255,255,255,0.04)", color: paused ? "#0f1f02" : "#dfeada" }} onClick={() => setPaused((v) => !v)}>{paused ? <Play size={18} /> : <Pause size={18} />}</button>
        <button type="button" aria-label="próximo" style={btn} onClick={() => go(1)}><ChevronRight size={20} /></button>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: JB, fontSize: 11, color: DIM, marginLeft: 8 }}>
          ritmo
          <input type="range" min={3000} max={12000} step={1000} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          <span style={{ color: "#cfe8c0", width: 26 }}>{(speed / 1000).toFixed(0)}s</span>
        </label>
        <span style={{ marginLeft: "auto", fontFamily: JB, fontSize: 10.5, color: DIM_2 }}>ideia: 1 oferta grande por vez · gira sozinho · próximas na tira ↑</span>
      </footer>
    </main>
  );
}
