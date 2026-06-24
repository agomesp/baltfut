import type { BracketColumn, Group } from "@/lib/espn";
import { teamNamePt } from "@/lib/team-names";
import { BRIC, JB, SAIRA, LIME, FlagIcon, ViewHeader } from "@/components/live/bf-ui";

export interface BracketViewProps {
  columns: BracketColumn[];
  /** Standings, so first-round seeds ("1A", "2B") resolve to real teams + flags. */
  groups: Group[];
}

/** A seed like "1A"/"2B" → the team currently in that group position, else null. */
function resolveSeed(seed: string, byGroup: Map<string, Group>): { code: string; name: string } | null {
  const m = seed.match(/^([12])([A-L])$/);
  if (!m) return null;
  const row = byGroup.get(m[2])?.rows.find((r) => r.rank === Number(m[1]));
  return row ? { code: row.code, name: row.name } : null;
}

function Slot({ seed, byGroup }: { seed: string; byGroup: Map<string, Group> }) {
  const team = resolveSeed(seed, byGroup);
  if (!team) {
    return <span style={{ fontFamily: JB, fontSize: 12, letterSpacing: "0.04em", color: "#8fa898" }}>{seed}</span>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <FlagIcon code={team.code} size={12} />
      <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 13, color: "#f1f7f0" }}>{team.code}</span>
      <span style={{ fontFamily: BRIC, fontSize: 11.5, color: "#7d9a86", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(team.code, team.name)}</span>
    </span>
  );
}

const colHead = { fontFamily: JB, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 6 };
const slotCard = { borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" };

export function BracketView({ columns, groups }: BracketViewProps) {
  const byGroup = new Map(groups.map((g) => [g.letter, g]));

  return (
    <section>
      <ViewHeader label="// CHAVEAMENTO" sub="mata-mata · as vagas são definidas após a fase de grupos" />

      <div style={{ overflowX: "auto", paddingBottom: 12 }}>
        <div style={{ display: "flex", gap: 20, minWidth: "max-content", height: 840 }}>
          {columns.map((col) => (
            <div key={col.label} style={{ flex: "0 0 230px", display: "flex", flexDirection: "column" }}>
              <div style={{ ...colHead, color: "#9bb6a6" }}>{col.label}</div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
                {col.matches.map((bm, i) => (
                  <div key={i} style={slotCard}>
                    <div style={{ display: "flex", alignItems: "center", padding: "7px 11px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <Slot seed={bm.a} byGroup={byGroup} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", padding: "7px 11px" }}>
                      <Slot seed={bm.b} byGroup={byGroup} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Campeão */}
          <div style={{ flex: "0 0 200px", display: "flex", flexDirection: "column" }}>
            <div style={{ ...colHead, color: LIME }}>Campeão</div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ borderRadius: 14, border: "1px solid rgba(200,255,45,0.45)", background: "linear-gradient(180deg, rgba(200,255,45,0.06), transparent)", boxShadow: "0 0 30px -10px rgba(200,255,45,0.5)", padding: "26px 16px", textAlign: "center" }}>
                <div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 52, lineHeight: 1, color: LIME }}>?</div>
                <div style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9bb6a6", marginTop: 10 }}>Levante a taça</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
