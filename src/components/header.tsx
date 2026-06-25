"use client";

import { useNow } from "@/lib/use-now";
import { wcProgress } from "@/lib/wc-progress";

export type ViewKey = "live" | "matches" | "groups" | "results" | "bracket";

const BRIC = "var(--font-bric)";
const JB = "var(--font-jb)";

const NAV: { key: ViewKey; label: string }[] = [
  { key: "live", label: "AO VIVO" },
  { key: "matches", label: "JOGOS" },
  { key: "groups", label: "GRUPOS" },
  { key: "results", label: "RESULTADOS" },
  { key: "bracket", label: "CHAVEAMENTO" },
];

export interface HeaderProps {
  view: ViewKey;
  onView: (v: ViewKey) => void;
  dark: boolean;
  onToggleTheme: () => void;
  followCode: string | null;
  followName: string | null;
  onClearFollow: () => void;
}

export function Header({ view, onView, dark, onToggleTheme, followCode, followName, onClearFollow }: HeaderProps) {
  const now = useNow(1000);
  const wc = wcProgress(now);

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(4,17,10,0.62)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      {/* World Cup progress (full-bleed) */}
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(wc.ratio * 100).toFixed(1)}%`, background: "linear-gradient(90deg,#3a7d2c,#c8ff2d)", boxShadow: "0 0 12px rgba(200,255,45,0.5)" }} />
      </div>

      <div className="bf-headbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", color: "#f1f7f0" }}>BaltFut</span>
          <span style={{ fontFamily: JB, fontSize: 10.5, letterSpacing: "0.1em", color: "#7d9a86" }}>
            COPA DO MUNDO <span style={{ color: "#c8ff2d" }}>26.</span> · {wc.pct}% CONCLUÍDA
          </span>
        </div>

        <div className="bf-nav" style={{ display: "flex", fontFamily: JB, fontSize: 11, letterSpacing: "0.04em", alignItems: "center", flexWrap: "wrap" }}>
          {NAV.map((t) => {
            const active = t.key === view;
            return (
              <button key={t.key} onClick={() => onView(t.key)} style={{ position: "relative", background: "transparent", border: "none", padding: "2px 0 6px", cursor: "pointer", fontFamily: JB, fontSize: 11, letterSpacing: "0.04em", color: active ? "#f1f7f0" : "#6f8a78" }}>
                {t.label}
                {active ? <span style={{ position: "absolute", left: 0, bottom: -1, width: "100%", height: 2, background: "#c8ff2d" }} /> : null}
              </button>
            );
          })}

          {followCode ? (
            <button onClick={onClearFollow} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: JB, fontSize: 10.5, letterSpacing: "0.06em", color: "#0f1f02", background: "#c8ff2d", border: "none", borderRadius: 999, padding: "7px 12px", cursor: "pointer" }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "#0f1f02" }} />
              {followName} <span style={{ opacity: 0.6 }}>✕</span>
            </button>
          ) : null}

          <button onClick={onToggleTheme} aria-label="Alternar tema" style={{ border: "1px solid rgba(255,255,255,0.16)", borderRadius: 999, padding: "7px 13px", color: "#cfd3ce", cursor: "pointer", background: "transparent", fontFamily: JB, fontSize: 11, letterSpacing: "0.04em" }}>
            {dark ? "ESCURO" : "CLARO"}
          </button>
        </div>
      </div>
    </header>
  );
}
