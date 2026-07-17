"use client";

import type { CSSProperties } from "react";
import type { ViewKey } from "@/components/header";
import { AnimatedTabIcon } from "@/components/live/animated-tab-icon";

/**
 * Persistent icon+label bottom navigation — the app's primary nav (the top bar's
 * page buttons were removed). Fixed bottom-center; horizontally scrollable on
 * narrow screens. Tabs magnify on hover; the selected tab's icon loop-animates
 * (per-icon micro-animation, see AnimatedTabIcon); the AI tab is rainbow.
 *
 * The default/live design is v3 ("2.1 sport"): an elevated gradient dock with a
 * neon top strip and a solid-lime active pill. v1/v2/v22 remain as UX-lab
 * comparison variants (surface hierarchy + active-state experiments).
 */
const ITEMS: { key: ViewKey; label: string }[] = [
  { key: "live", label: "Ao vivo" },
  { key: "matches", label: "Jogos" },
  { key: "groups", label: "Grupos" },
  { key: "results", label: "Result." },
  { key: "bracket", label: "Chaves" },
  { key: "ai", label: "AI" },
];

// Rainbow text for the AI tab (matches the house-bot styling); animates like the
// old top-nav AI label.
const RAINBOW_DOCK: CSSProperties = {
  background: "linear-gradient(90deg,#ff3b30,#ff9500,#ffcc00,#34c759,#00c7be,#0a84ff,#bf5af2,#ff3b30)",
  backgroundSize: "200% auto",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "#0a84ff",
  animation: "bfrainbow 4s linear infinite",
};

type Variant = "v1" | "v2" | "v3" | "v22";

interface Surface {
  bar: CSSProperties;
  gap: number;
  pad: string;
  inactive: string;
  activeBg: string;
  activeText: string;
  activeGlow: string;
  /** Lime top-indicator bar over the active tab (v2). */
  indicator: boolean;
  /** Neon hairline across the top edge of the whole dock (v3 sport). */
  topStrip: boolean;
}

const SURFACES: Record<Variant, Surface> = {
  v1: {
    bar: {
      background: "rgba(6,18,11,0.92)",
      border: "1px solid rgba(200,255,45,0.22)",
      boxShadow: "0 14px 40px -14px rgba(0,0,0,0.7)",
    },
    gap: 2,
    pad: "7px 8px",
    inactive: "#9bb6a6",
    activeBg: "rgba(200,255,45,0.16)",
    activeText: "#eaffc0",
    activeGlow: "none",
    indicator: false,
    topStrip: false,
  },
  // Elevated surface: lighter desaturated forest (one step above the page),
  // stronger border, outer shadow + inset top highlight = reads as "floating".
  v2: {
    bar: {
      background: "linear-gradient(180deg, rgba(28,45,32,0.97), rgba(17,30,21,0.97))",
      border: "1px solid rgba(200,255,45,0.3)",
      boxShadow:
        "0 16px 40px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,255,45,0.05), inset 0 1px 0 rgba(255,255,255,0.06)",
    },
    gap: 4,
    pad: "9px 11px",
    inactive: "#c2cfc4", // brighter than v1 — was too faint
    activeBg: "rgba(200,255,45,0.2)",
    activeText: "#f3ffd6",
    activeGlow: "0 0 14px -2px rgba(200,255,45,0.4)",
    indicator: true,
    topStrip: false,
  },
  // Sportier: same elevated base but more neon energy — a SOLID lime CTA pill with
  // dark ink (max contrast), a stronger outer lime glow, and a neon hairline across
  // the dock's top edge. Bold without leaving the palette.
  v3: {
    bar: {
      background: "linear-gradient(180deg, rgba(22,38,27,0.98), rgba(10,20,13,0.98))",
      border: "1px solid rgba(200,255,45,0.45)",
      boxShadow:
        "0 18px 46px -10px rgba(0,0,0,0.65), 0 0 26px -6px rgba(200,255,45,0.28), inset 0 1px 0 rgba(255,255,255,0.07)",
    },
    gap: 5,
    pad: "9px 12px",
    inactive: "#cdd9cf",
    activeBg: "var(--bf-lime)", // solid lime pill (matches CTA buttons)
    activeText: "#0f1f02", // dark ink on lime
    activeGlow: "0 0 20px -2px rgba(200,255,45,0.7)",
    indicator: false,
    topStrip: true,
  },
  // Middle ground: the elevated 2.0 surface, but with the sport's solid-lime CTA
  // pill for the active tab. Energy on the active state without the neon top strip.
  v22: {
    bar: {
      background: "linear-gradient(180deg, rgba(28,45,32,0.97), rgba(17,30,21,0.97))",
      border: "1px solid rgba(200,255,45,0.3)",
      boxShadow:
        "0 16px 40px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,255,45,0.05), inset 0 1px 0 rgba(255,255,255,0.06)",
    },
    gap: 4,
    pad: "9px 11px",
    inactive: "#c2cfc4",
    activeBg: "var(--bf-lime)", // solid lime pill
    activeText: "#0f1f02", // dark ink on lime
    activeGlow: "0 0 16px -2px rgba(200,255,45,0.55)",
    indicator: false,
    topStrip: false,
  },
};

export function BottomTabBar({ view, onView, variant = "v1", inline = false }: { view: ViewKey; onView: (v: ViewKey) => void; variant?: Variant; inline?: boolean }) {
  const s = SURFACES[variant];
  return (
    <nav
      style={{
        // `inline`: sit in a flex row (e.g. beside the live second-dock); the
        // parent owns the fixed bottom-centered positioning. Default: fixed itself.
        ...(inline
          ? { position: "relative", flex: "none" }
          : { position: "fixed", left: "50%", bottom: 14, transform: "translateX(-50%)", zIndex: 65 }),
        display: "flex",
        gap: s.gap,
        maxWidth: "calc(100vw - 24px)",
        overflowX: "auto",
        borderRadius: 16,
        padding: variant === "v2" ? 7 : 6,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        ...s.bar,
      }}
    >
      {/* v3 sport: neon hairline across the dock's top edge. */}
      {s.topStrip ? (
        <span style={{ position: "absolute", top: 3, left: 16, right: 16, height: 2.5, borderRadius: 999, background: "linear-gradient(90deg, transparent, var(--bf-lime), transparent)", boxShadow: "0 0 10px rgba(200,255,45,0.6)", pointerEvents: "none" }} />
      ) : null}
      {ITEMS.map((t) => {
        const active = t.key === view;
        const isAI = t.key === "ai";
        // AI keeps its rainbow in both states; an active AI tab uses a neutral
        // elevated pill (not solid lime) so the rainbow stays legible.
        const bg = isAI ? (active ? "rgba(255,255,255,0.07)" : "transparent") : active ? s.activeBg : "transparent";
        const glow = isAI ? (active ? "0 0 14px -4px rgba(255,255,255,0.35)" : "none") : active ? s.activeGlow : "none";
        const iconColor = active ? s.activeText : s.inactive;
        return (
          <button
            key={t.key}
            className="bf-dock-tab"
            onClick={() => onView(t.key)}
            aria-label={t.label}
            style={{
              position: "relative",
              flex: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              minWidth: 56,
              padding: s.pad,
              borderRadius: 11,
              border: "none",
              cursor: "pointer",
              background: bg,
              boxShadow: glow,
              color: active ? s.activeText : s.inactive,
              fontFamily: "var(--font-jb)",
              fontSize: 9.5,
              letterSpacing: "0.03em",
            }}
          >
            {/* v2 "current mode" top indicator bar (sport v3 uses a dock top strip). */}
            {s.indicator && active ? (
              <span style={{ position: "absolute", top: 0, left: "50%", transform: "translate(-50%,-1px)", width: 22, height: 3, borderRadius: 999, background: "var(--bf-lime)", boxShadow: "0 0 8px rgba(200,255,45,0.7)" }} />
            ) : null}
            <AnimatedTabIcon view={t.key} size={18} color={iconColor} animate={active} />
            <span style={isAI ? RAINBOW_DOCK : undefined}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
