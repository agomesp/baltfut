"use client";

import { AnimatedTabIcon } from "@/components/live/animated-tab-icon";

/**
 * The live tab's own mini-dock: a second dock that sits beside the primary
 * BottomTabBar and switches the live view between "Partidas" (live matches) and
 * "Chaveamento" (the bracket palpite). Same elevated v3 surface as the main dock
 * so they read as a pair, but tinted YELLOW (not the main dock's lime) so it's
 * clearly a distinct, secondary control.
 */
export type LiveSubTab = "partidas" | "chaveamento";

const YELLOW = "#ffd60a";
const INK = "#241d02"; // dark ink on the yellow active pill

const ITEMS: { key: LiveSubTab; label: string; icon: "live" | "bracket" }[] = [
  { key: "partidas", label: "Partidas", icon: "live" },
  { key: "chaveamento", label: "Chaveamento", icon: "bracket" },
];

export function LiveSubDock({ value, onChange }: { value: LiveSubTab; onChange: (v: LiveSubTab) => void }) {
  return (
    <nav
      aria-label="Alternar entre partidas ao vivo e chaveamento"
      style={{
        position: "relative",
        flex: "none",
        display: "flex",
        gap: 5,
        borderRadius: 16,
        padding: 6,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        background: "linear-gradient(180deg, rgba(38,34,10,0.98), rgba(20,17,6,0.98))",
        border: `1px solid ${YELLOW}66`,
        boxShadow: `0 18px 46px -10px rgba(0,0,0,0.65), 0 0 26px -6px ${YELLOW}47, inset 0 1px 0 rgba(255,255,255,0.07)`,
      }}
    >
      {/* Neon yellow hairline across the top edge — mirrors the main dock's strip. */}
      <span style={{ position: "absolute", top: 3, left: 16, right: 16, height: 2.5, borderRadius: 999, background: `linear-gradient(90deg, transparent, ${YELLOW}, transparent)`, boxShadow: `0 0 10px ${YELLOW}aa`, pointerEvents: "none" }} />
      {ITEMS.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            className="bf-dock-tab"
            onClick={() => onChange(t.key)}
            aria-label={t.label}
            aria-pressed={active}
            style={{
              position: "relative",
              flex: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              minWidth: 62,
              padding: "9px 12px",
              borderRadius: 11,
              border: "none",
              cursor: "pointer",
              background: active ? YELLOW : "transparent",
              boxShadow: active ? `0 0 20px -2px ${YELLOW}c0` : "none",
              color: active ? INK : "#dcd6bf",
              fontFamily: "var(--font-jb)",
              fontSize: 9.5,
              letterSpacing: "0.03em",
            }}
          >
            <AnimatedTabIcon view={t.icon} size={18} color={active ? INK : "#dcd6bf"} animate={active} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
