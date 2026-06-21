import type { Group } from "@/lib/espn";
import { MONO, DISPLAY, cardStyle } from "@/components/primitives";
import { teamLabel } from "@/components/match-meta";

export interface GroupsViewProps {
  groups: Group[];
  followCode: string | null;
  onFollow: (code: string) => void;
}

function accentFor(rank: number): string {
  if (rank <= 2) return "var(--signal)";
  if (rank === 3) return "var(--line-2)";
  return "transparent";
}

export function GroupsView({ groups, followCode, onFollow }: GroupsViewProps) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-2)" }}>Classificação · 12 grupos</span>
        <span style={{ fontSize: 14, color: "var(--ink-3)" }}>Os 2 primeiros avançam. Toque numa seleção para segui-la pelo app.</span>
      </div>

      {groups.length === 0 ? (
        <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center", color: "var(--ink-3)" }}>Tabelas indisponíveis no momento.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {groups.map((g) => (
            <div key={g.letter} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 18, letterSpacing: "-0.012em" }}>Grupo {g.letter}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-3)" }}>P&nbsp;&nbsp;SG&nbsp;&nbsp;PTS</span>
              </div>
              {g.rows.map((r) => {
                const followed = r.code === followCode;
                return (
                  <button
                    key={r.code}
                    onClick={() => onFollow(r.code)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 14px 9px 0", borderBottom: "1px solid var(--line)", cursor: "pointer", background: followed ? "var(--signal-tint)" : "transparent", border: "none", borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "var(--line)", textAlign: "left" }}
                  >
                    <span style={{ flex: "0 0 3px", alignSelf: "stretch", background: accentFor(r.rank) }} />
                    <span style={{ flex: "0 0 14px", fontFamily: MONO, fontSize: 12, color: "var(--ink-3)", textAlign: "right" }}>{r.rank}</span>
                    <span style={{ flex: "0 0 40px", fontFamily: MONO, fontWeight: 500, fontSize: 14, color: followed ? "var(--signal-strong)" : "var(--ink)" }}>{r.code}</span>
                    <span style={{ flex: "1 1 auto", fontSize: 14, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamLabel(r.code, r.name)}</span>
                    <span style={{ flex: "0 0 18px", fontFamily: MONO, fontSize: 13, color: "var(--ink-2)", textAlign: "center" }}>{r.played}</span>
                    <span style={{ flex: "0 0 30px", fontFamily: MONO, fontSize: 13, color: "var(--ink-2)", textAlign: "center" }}>{r.gd}</span>
                    <span style={{ flex: "0 0 26px", fontFamily: MONO, fontWeight: 500, fontSize: 14, color: "var(--ink)", textAlign: "right" }}>{r.points}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
