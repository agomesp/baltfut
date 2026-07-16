"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { showpieceScenarios } from "@/lib/showpiece/dossiers";
import { ShowpieceMatch } from "@/components/showpiece/showpiece-match";
import { BRIC, JB } from "@/components/live/bf-ui";

/**
 * Local preview of the two showpiece match views (final + third place), each in
 * its pre-match (palpite timer) and live states. Not wired into the app yet —
 * a design sandbox to review before promoting into the real live view.
 */

const TABS = [
  { key: "final-pre", label: "FINAL · PRÉ", accent: "#ffd76a" },
  { key: "final-live", label: "FINAL · AO VIVO", accent: "#ffd76a" },
  { key: "third-pre", label: "3º LUGAR · PRÉ", accent: "#e59b63" },
  { key: "third-live", label: "3º LUGAR · AO VIVO", accent: "#e59b63" },
] as const;

export default function FinaisPage() {
  const [now, setNow] = useState<number | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("final-pre");
  const [narrow, setNarrow] = useState(false);
  // Client-only timestamp set after mount — the pre-match countdowns are relative
  // to "now", so it must be the viewer's clock, not the static-export build time.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setNow(Date.now()), []);

  const scenarios = useMemo(() => (now == null ? null : showpieceScenarios(now)), [now]);
  const scenario = scenarios?.[tab] ?? null;

  const tabBtn = (active: boolean, accent: string): CSSProperties => ({
    padding: "8px 15px",
    borderRadius: 10,
    border: `1px solid ${active ? accent : "rgba(255,255,255,0.14)"}`,
    background: active ? `${accent}22` : "rgba(255,255,255,0.03)",
    color: active ? accent : "rgba(255,255,255,0.62)",
    fontFamily: JB,
    fontSize: 10.5,
    letterSpacing: "0.08em",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <main style={{ minHeight: "100vh", background: "#050409", color: "#eef3ea", padding: "16px 18px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Clean canvas: hide the app's global streamer/promo dock while previewing. */}
      <style>{`.bf-streamer-only{display:none!important}`}</style>
      {/* Control bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 15, color: "#fff" }}>
          BaltFut <span style={{ color: "#ffd76a" }}>· Palcos</span>
        </span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button key={t.key} type="button" style={tabBtn(tab === t.key, t.accent)} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setNarrow((v) => !v)}
          style={{ ...tabBtn(narrow, "#c8ff2d"), marginLeft: "auto" }}
        >
          {narrow ? "📱 MOBILE" : "🖥️ DESKTOP"}
        </button>
      </div>

      {/* Stage */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", minHeight: 0 }}>
        <div style={{ width: narrow ? 400 : "100%", maxWidth: narrow ? 400 : 1180, transition: "width .25s" }}>
          {scenario ? (
            <ShowpieceMatch key={`${tab}-${narrow}`} scenario={scenario} narrow={narrow} />
          ) : (
            <div style={{ padding: 60, textAlign: "center", fontFamily: JB, color: "#6f8a78" }}>carregando palco…</div>
          )}
        </div>
      </div>
    </main>
  );
}
