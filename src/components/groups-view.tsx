import type { Group } from "@/lib/espn";
import { teamNamePt } from "@/lib/team-names";
import { BRIC, JB, SAIRA, LIME, FlagIcon, ViewHeader } from "@/components/live/bf-ui";

export interface GroupsViewProps {
  groups: Group[];
  followCode: string | null;
  onFollow: (code: string) => void;
}

export function GroupsView({ groups, followCode, onFollow }: GroupsViewProps) {
  return (
    <section>
      <ViewHeader label="// GRUPOS" sub="classificação · 12 grupos · os 2 primeiros avançam" />

      {groups.length === 0 ? (
        <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "40px 24px", textAlign: "center", fontFamily: BRIC, color: "#7d9a86" }}>
          Tabelas indisponíveis no momento.
        </div>
      ) : (
        // `min(100%, 440px)` keeps each card from forcing horizontal scroll on a
        // phone (it shrinks to the viewport) while still tiling multi-column on
        // wider screens.
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 440px), 1fr))", gap: 16 }}>
          {groups.map((g) => (
            <div key={g.letter} style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 16, color: "#f1f7f0" }}>Grupo {g.letter}</span>
                <span style={{ fontFamily: JB, fontSize: 9.5, letterSpacing: "0.1em", color: "#6f8a78" }}>P&nbsp;&nbsp;&nbsp;SG&nbsp;&nbsp;&nbsp;PTS</span>
              </div>
              {g.rows.map((r) => {
                const followed = r.code === followCode;
                const qualifies = r.rank <= 2;
                return (
                  <button
                    key={r.code}
                    onClick={() => onFollow(r.code)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "9px 16px 9px 0", borderTop: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", background: followed ? "rgba(200,255,45,0.08)" : "transparent", border: "none", textAlign: "left" }}
                  >
                    <span style={{ flex: "0 0 3px", alignSelf: "stretch", background: qualifies ? LIME : "transparent" }} />
                    <span style={{ flex: "0 0 14px", fontFamily: JB, fontSize: 11, color: qualifies ? "#caa94a" : "#6a716b", textAlign: "right" }}>{r.rank}</span>
                    <FlagIcon code={r.code} size={14} />
                    <span style={{ flex: "0 0 38px", fontFamily: BRIC, fontWeight: 800, fontSize: 13.5, color: followed ? LIME : "#f1f7f0" }}>{r.code}</span>
                    <span style={{ flex: "1 1 auto", fontFamily: BRIC, fontSize: 13.5, color: "#cfd9d1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(r.code, r.name)}</span>
                    <span style={{ flex: "0 0 24px", fontFamily: SAIRA, fontWeight: 600, fontSize: 14, color: "#6f8a78", textAlign: "center" }}>{r.played}</span>
                    <span style={{ flex: "0 0 34px", fontFamily: SAIRA, fontWeight: 700, fontSize: 15, color: "#9bb6a6", textAlign: "center" }}>{r.gd}</span>
                    <span style={{ flex: "0 0 30px", fontFamily: SAIRA, fontWeight: 800, fontSize: 16, color: "#f1f7f0", textAlign: "right" }}>{r.points}</span>
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
