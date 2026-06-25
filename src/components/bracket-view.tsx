import type { Match, KnockoutColumn } from "@/lib/espn";
import { isPlaceholderTeam, seedLabel } from "@/lib/espn";
import { teamNamePt } from "@/lib/team-names";
import { BRIC, JB, SAIRA, LIME, FlagIcon, ViewHeader } from "@/components/live/bf-ui";

export interface BracketViewProps {
  /** Real knockout fixtures from ESPN, grouped into ordered stage columns. */
  stages: KnockoutColumn[];
}

const colHead = { fontFamily: JB, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 6 };
const slotCard = { borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" };

/** One side of a tie: a decided team (flag + code + name) or a placeholder seed
 *  ("2º Grupo H", "Venc. 32-avos 1"). Shows the score once the match is underway. */
function Slot({ team, score }: { team: Match["home"]; score: number | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 11px" }}>
      {isPlaceholderTeam(team.name) ? (
        <span style={{ fontFamily: JB, fontSize: 11, letterSpacing: "0.02em", color: "#8fa898", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seedLabel(team.name)}</span>
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <FlagIcon code={team.abbreviation} size={12} />
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 13, color: "#f1f7f0" }}>{team.abbreviation}</span>
          <span style={{ fontFamily: BRIC, fontSize: 11.5, color: "#7d9a86", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(team.abbreviation, team.name)}</span>
        </span>
      )}
      {score != null ? <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 15, color: "#fff", flex: "none" }}>{score}</span> : null}
    </div>
  );
}

export function BracketView({ stages }: BracketViewProps) {
  return (
    <section>
      <ViewHeader label="// CHAVEAMENTO" sub="mata-mata · times já definidos aparecem com bandeira; os demais resolvem conforme a fase de grupos avança" />

      {stages.length === 0 ? (
        <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "40px 24px", textAlign: "center", fontFamily: BRIC, color: "#8fa898" }}>
          O mata-mata ainda não foi sorteado.
        </div>
      ) : (
        <div style={{ overflowX: "auto", paddingBottom: 12 }}>
          <div style={{ display: "flex", gap: 20, minWidth: "max-content", height: 840 }}>
            {stages.map((col) => (
              <div key={col.slug} style={{ flex: "0 0 244px", display: "flex", flexDirection: "column" }}>
                <div style={{ ...colHead, color: "#9bb6a6" }}>{col.label}</div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
                  {col.matches.map((mt) => {
                    const played = mt.state !== "pre";
                    return (
                      <div key={mt.id} style={slotCard}>
                        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <Slot team={mt.home} score={played ? mt.homeScore ?? 0 : null} />
                        </div>
                        <Slot team={mt.away} score={played ? mt.awayScore ?? 0 : null} />
                      </div>
                    );
                  })}
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
      )}
    </section>
  );
}
