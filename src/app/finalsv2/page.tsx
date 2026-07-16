"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { VoteEntry } from "@/lib/votes";
import { showpieceScenarios, MOCK_STATS, type Scenario } from "@/lib/showpiece/dossiers";
import { chegandoPool, MOCK_RANKING } from "@/lib/showpiece/live-data";
import { ShowpieceMatchV2 } from "@/components/showpiece/showpiece-match-v2";
import { BRIC, JB } from "@/components/live/bf-ui";

/**
 * Local preview of the v2 showpiece — the marquee match view with the real
 * live-engagement layer woven in: "DIGITE X×Y NO CHAT" CTA, the live "PALPITES
 * CHEGANDO" feed, and the Ranking dos Subs. Sandbox only; not wired to the app.
 * A popover switches between the four states.
 */

const TABS = [
  { key: "final-pre", label: "Final · Pré-jogo", icon: "🏆", accent: "#ffd76a" },
  { key: "final-live", label: "Final · Ao Vivo", icon: "🔴", accent: "#ffd76a" },
  { key: "third-pre", label: "3º Lugar · Pré-jogo", icon: "🥉", accent: "#e59b63" },
  { key: "third-live", label: "3º Lugar · Ao Vivo", icon: "🔴", accent: "#e59b63" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function ViewPopover({ tab, onSelect }: { tab: TabKey; onSelect: (k: TabKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cur = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          padding: "8px 13px",
          borderRadius: 10,
          border: `1px solid ${cur.accent}`,
          background: `${cur.accent}1e`,
          color: cur.accent,
          fontFamily: JB,
          fontSize: 11,
          letterSpacing: "0.06em",
          cursor: "pointer",
          minWidth: 210,
          justifyContent: "space-between",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden>{cur.icon}</span>
          <span style={{ color: "#fff", textTransform: "uppercase" }}>{cur.label}</span>
        </span>
        <span aria-hidden style={{ transition: "transform .18s", transform: open ? "rotate(180deg)" : "none", opacity: 0.8 }}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 7px)",
            left: 0,
            zIndex: 50,
            minWidth: 236,
            padding: 6,
            borderRadius: 13,
            background: "rgba(12,10,20,0.98)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 22px 50px -14px rgba(0,0,0,0.8)",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            backdropFilter: "blur(6px)",
          }}
        >
          <span style={{ padding: "5px 10px 3px", fontFamily: JB, fontSize: 8.5, letterSpacing: "0.14em", color: "rgba(255,255,255,0.4)" }}>ESCOLHER PALCO</span>
          {TABS.map((t) => {
            const active = t.key === tab;
            const itemStyle: CSSProperties = {
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 11px",
              borderRadius: 9,
              border: "1px solid transparent",
              background: active ? `${t.accent}1c` : "transparent",
              color: active ? t.accent : "rgba(255,255,255,0.75)",
              fontFamily: BRIC,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
            };
            return (
              <button key={t.key} type="button" role="menuitem" onClick={() => { onSelect(t.key); setOpen(false); }} style={itemStyle}>
                <span aria-hidden style={{ fontSize: 14 }}>{t.icon}</span>
                <span style={{ flex: 1 }}>{t.label}</span>
                {active && <span aria-hidden style={{ color: t.accent }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Sandbox-only: reveal the mock palpite pool one entry at a time so the feed
 *  visibly "chega ao vivo". Remounted per stage (keyed), so the reveal restarts. */
function useLiveArrivals(pool: VoteEntry[], startCount: number, intervalMs: number): VoteEntry[] {
  const [n, setN] = useState(startCount);
  useEffect(() => {
    if (n >= pool.length) return;
    const id = setInterval(() => setN((v) => Math.min(pool.length, v + 1)), intervalMs);
    return () => clearInterval(id);
  }, [pool.length, intervalMs, n]);
  return useMemo(() => pool.slice(0, n), [pool, n]);
}

function SandboxShowpiece({ scenario, narrow, nowMs }: { scenario: Scenario; narrow: boolean; nowMs: number }) {
  const pool = useMemo(() => chegandoPool(scenario, nowMs), [scenario, nowMs]);
  const entries = useLiveArrivals(pool, 6, 2600);
  return (
    <ShowpieceMatchV2
      scenario={scenario}
      narrow={narrow}
      entries={entries}
      ranks={MOCK_RANKING}
      myName="agomesp"
      stats={MOCK_STATS}
    />
  );
}

export default function FinaisV2Page() {
  const [now, setNow] = useState<number | null>(null);
  const [tab, setTab] = useState<TabKey>("final-pre");
  const [narrow, setNarrow] = useState(false);
  // Client-only clock (see /finais rationale).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setNow(Date.now()), []);

  const scenarios = useMemo(() => (now == null ? null : showpieceScenarios(now)), [now]);
  const scenario = scenarios?.[tab] ?? null;

  return (
    <main style={{ minHeight: "100vh", background: "#050409", color: "#eef3ea", padding: "16px 18px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Clean canvas: hide the app's global streamer/promo dock while previewing. */}
      <style>{`.bf-streamer-only{display:none!important}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 15, color: "#fff" }}>
          BaltFut <span style={{ color: "#ffd76a" }}>· Palcos v2</span>
        </span>
        <ViewPopover tab={tab} onSelect={setTab} />
        <button
          type="button"
          onClick={() => setNarrow((v) => !v)}
          style={{ marginLeft: "auto", padding: "8px 13px", borderRadius: 10, border: `1px solid ${narrow ? "#c8ff2d" : "rgba(255,255,255,0.14)"}`, background: narrow ? "#c8ff2d1e" : "rgba(255,255,255,0.03)", color: narrow ? "#c8ff2d" : "rgba(255,255,255,0.62)", fontFamily: JB, fontSize: 10.5, letterSpacing: "0.08em", cursor: "pointer" }}
        >
          {narrow ? "📱 MOBILE" : "🖥️ DESKTOP"}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center", minHeight: 0 }}>
        <div style={{ width: narrow ? 400 : "100%", maxWidth: narrow ? 400 : 1180, transition: "width .25s" }}>
          {scenario && now != null ? (
            <SandboxShowpiece key={`${tab}-${narrow}`} scenario={scenario} narrow={narrow} nowMs={now} />
          ) : (
            <div style={{ padding: 60, textAlign: "center", fontFamily: JB, color: "#6f8a78" }}>carregando palco…</div>
          )}
        </div>
      </div>
    </main>
  );
}
