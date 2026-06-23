import { MONO, DISPLAY } from "@/components/primitives";

export type ViewKey = "live" | "matches" | "groups" | "results" | "bracket" | "ranking";

const TABS: { key: ViewKey; idx: string; label: string }[] = [
  { key: "live", idx: "01", label: "Ao vivo" },
  { key: "matches", idx: "02", label: "Jogos" },
  { key: "groups", idx: "03", label: "Grupos" },
  { key: "results", idx: "04", label: "Resultados" },
  { key: "bracket", idx: "05", label: "Chaveamento" },
  { key: "ranking", idx: "06", label: "Ranking dos Subs" },
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

export function Header({
  view,
  onView,
  dark,
  onToggleTheme,
  followCode,
  followName,
  onClearFollow,
}: HeaderProps) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "var(--bg)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "14px 24px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
            <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 25, letterSpacing: "-0.025em", lineHeight: 1 }}>
              BaltFut&nbsp;-&nbsp;Copa&nbsp;do&nbsp;Mundo
            </span>
            <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 25, letterSpacing: "-0.025em", lineHeight: 1, color: "var(--signal)" }}>
              26.
            </span>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-2)" }}>
            48&nbsp;seleções&nbsp;/&nbsp;12&nbsp;grupos&nbsp;/&nbsp;EUA·CAN·MEX
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {followCode ? (
            <button
              onClick={onClearFollow}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--signal-ink)",
                background: "var(--signal)",
                border: "none",
                borderRadius: 999,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--signal-ink)" }} />
              {followName} <span style={{ opacity: 0.6 }}>✕</span>
            </button>
          ) : null}
          <button
            onClick={onToggleTheme}
            aria-label="Alternar tema"
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: "var(--ink-2)",
              background: "transparent",
              border: "1px solid var(--line-2)",
              borderRadius: 999,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            {dark ? "Escuro" : "Claro"}
          </button>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          gap: 0,
          overflowX: "auto",
          // overflow-x:auto forces overflow-y to compute to auto; the active-tab
          // underline at bottom:-1px would then trigger a phantom vertical
          // scrollbar. Pin it hidden.
          overflowY: "hidden",
        }}
      >
        {TABS.map((t) => {
          const active = t.key === view;
          const isRank = t.key === "ranking";
          return (
            <button
              key={t.key}
              onClick={() => onView(t.key)}
              style={{
                position: "relative",
                flex: "0 0 auto",
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                background: "transparent",
                border: "none",
                padding: "14px 18px 13px 0",
                marginRight: 18,
                cursor: "pointer",
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 11, color: isRank ? "var(--rank)" : "var(--ink-3)" }}>{t.idx}</span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 14,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: isRank ? "var(--rank)" : active ? "var(--ink)" : "var(--ink-2)",
                }}
              >
                {t.label}
              </span>
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 18,
                  bottom: -1,
                  height: 2,
                  background: active ? (isRank ? "var(--rank)" : "var(--signal)") : "transparent",
                }}
              />
            </button>
          );
        })}
      </div>
    </header>
  );
}
