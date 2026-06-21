import type { BracketColumn } from "@/lib/espn";
import { MONO, DISPLAY, cardStyle } from "@/components/primitives";

export interface BracketViewProps {
  columns: BracketColumn[];
}

export function BracketView({ columns }: BracketViewProps) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-2)" }}>Mata-mata · 32-avos → final</span>
        <span style={{ fontSize: 14, color: "var(--ink-3)" }}>Esquema — as vagas são definidas após a fase de grupos.</span>
      </div>

      <div style={{ overflowX: "auto", paddingBottom: 12 }}>
        <div style={{ display: "flex", gap: 20, minWidth: "max-content", height: 880 }}>
          {columns.map((col) => (
            <div key={col.label} style={{ flex: "0 0 180px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-2)", paddingBottom: 10, borderBottom: "1px solid var(--line)", marginBottom: 6 }}>{col.label}</div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
                {col.matches.map((bm, i) => (
                  <div key={i} style={cardStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: "1px solid var(--line)" }}>
                      <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--ink)" }}>{bm.a}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px" }}>
                      <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--ink)" }}>{bm.b}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ flex: "0 0 180px", display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--signal-strong)", paddingBottom: 10, borderBottom: "1px solid var(--line)", marginBottom: 6 }}>Campeão</div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ ...cardStyle, border: "1px solid var(--signal)" }}>
                <div style={{ height: 3, background: "var(--signal)" }} />
                <div style={{ padding: "22px 14px", textAlign: "center" }}>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 52, lineHeight: 1, color: "var(--signal)" }}>?</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-2)", marginTop: 10 }}>Levante a taça</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
