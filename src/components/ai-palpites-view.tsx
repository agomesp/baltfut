"use client";

import { useMemo } from "react";
import type { Match } from "@/lib/espn";
import { isPlaceholderTeam, seedLabel } from "@/lib/espn";
import { buildAiPalpites, type ScorePalpite } from "@/lib/ai-palpite";
import { fmtTime, groupByDay } from "@/lib/format";
import { teamNamePt } from "@/lib/team-names";
import { useIsNarrow } from "@/lib/use-is-narrow";
import { groupLabelFor } from "@/components/match-meta";
import {
  BRIC,
  JB,
  SAIRA,
  LIME,
  DIM,
  DIM_2,
  FlagIcon,
  FlagCrest,
  ViewHeader,
  teamAccent,
} from "@/components/live/bf-ui";

export interface AiPalpitesViewProps {
  matches: Match[];
  groupByTeam: Record<string, string>;
}

const card = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
} as const;

/** A confidence bar (0–1) — how lopsided I think the matchup is. */
function Confidence({ value }: { value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{ width: 54, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
        <div style={{ width: `${Math.round(value * 100)}%`, height: "100%", background: LIME }} />
      </div>
      <span style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.06em", color: DIM_2, flex: "none" }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

/** The predicted scoreline pill — winner's number in white, loser dimmed. */
function ScorePill({ score }: { score: ScorePalpite }) {
  const homeOn = score.winner !== "away";
  const awayOn = score.winner !== "home";
  return (
    <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 22, minWidth: 58, textAlign: "center", lineHeight: 0.9, whiteSpace: "nowrap" }}>
      <span style={{ color: homeOn ? "#fff" : "#7d9a86" }}>{score.home}</span>
      <span style={{ color: "#42565b", margin: "0 7px" }}>–</span>
      <span style={{ color: awayOn ? "#fff" : "#7d9a86" }}>{score.away}</span>
    </span>
  );
}

const colHead = { fontFamily: JB, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 6 };

/** One mata-mata slot: a decided team (highlighted lime when I back it), or a seed. */
function BracketSlot({ team, advances }: { team: Match["home"]; advances: boolean }) {
  if (isPlaceholderTeam(team.name)) {
    return (
      <div style={{ padding: "7px 11px" }}>
        <span style={{ fontFamily: JB, fontSize: 11, letterSpacing: "0.02em", color: "#8fa898", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seedLabel(team.name)}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", opacity: advances ? 1 : 0.5 }}>
      <FlagIcon code={team.abbreviation} size={12} />
      <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 13, color: advances ? LIME : "#f1f7f0" }}>{team.abbreviation}</span>
      <span style={{ fontFamily: BRIC, fontSize: 11.5, color: DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(team.abbreviation, team.name)}</span>
      {advances ? <span style={{ marginLeft: "auto", fontFamily: JB, fontSize: 9, color: LIME, flex: "none" }}>▸</span> : null}
    </div>
  );
}

export function AiPalpitesView({ matches, groupByTeam }: AiPalpitesViewProps) {
  const narrow = useIsNarrow();
  const model = useMemo(() => buildAiPalpites(matches), [matches]);
  const { upcoming, knockout, champion, ranking } = model;

  const days = useMemo(() => groupByDay(upcoming.map((u) => u.match)), [upcoming]);
  const palpiteByMatch = useMemo(
    () => new Map(upcoming.map((u) => [u.match.id, u.score])),
    [upcoming],
  );

  return (
    <section>
      <ViewHeader label="// AI PALPITES" sub="previsões da IA do BaltFut · placar, mata-mata e campeão · geradas por força das seleções" />

      {/* Champion pick + força ranking */}
      {champion ? (
        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0,1fr) minmax(0,1.1fr)", gap: 16, marginBottom: 26 }}>
          <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(200,255,45,0.3)", background: "linear-gradient(180deg, rgba(200,255,45,0.07), transparent)", padding: "22px 24px", display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 2, background: "linear-gradient(90deg,#3a7d2c,#c8ff2d)", boxShadow: "0 0 14px rgba(200,255,45,0.5)" }} />
            <FlagCrest code={champion.code} accent={teamAccent(champion.code)} size={84} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.16em", color: LIME, marginBottom: 6 }}>CAMPEÃO PROJETADO</div>
              <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(30px,5vw,46px)", lineHeight: 0.95, letterSpacing: "-0.02em", color: "#f1f7f0" }}>{champion.code}</div>
              <div style={{ fontFamily: BRIC, fontSize: 14, color: DIM, marginTop: 4 }}>{teamNamePt(champion.code, champion.name)}</div>
            </div>
          </div>

          <div style={{ ...card, padding: "16px 18px" }}>
            <div style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.12em", color: DIM, marginBottom: 12 }}>FORÇA · FAVORITOS AINDA VIVOS</div>
            {ranking.map((t, i) => (
              <div key={t.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 14, color: i === 0 ? LIME : DIM_2, width: 18, flex: "none" }}>{i + 1}</span>
                <FlagIcon code={t.code} size={12} />
                <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 13, color: "#f1f7f0", flex: "none" }}>{t.code}</span>
                <span style={{ fontFamily: BRIC, fontSize: 12.5, color: DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(t.code, t.name)}</span>
                <div style={{ marginLeft: "auto", width: 70, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", flex: "none" }}>
                  <div style={{ width: `${t.power}%`, height: "100%", background: i === 0 ? LIME : "rgba(200,255,45,0.45)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Palpites for upcoming games */}
      <div style={{ fontFamily: JB, fontSize: 11, letterSpacing: "0.1em", color: "#9bb6a6", margin: "4px 4px 8px" }}>
        PALPITES DOS PRÓXIMOS JOGOS
      </div>
      {upcoming.length === 0 ? (
        <div style={{ ...card, padding: "28px 24px", textAlign: "center", fontFamily: BRIC, color: DIM, marginBottom: 26 }}>
          Nenhum jogo agendado para palpitar.
        </div>
      ) : (
        <div style={{ marginBottom: 26 }}>
          {days.map((day) => (
            <div key={day.key} style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: JB, fontSize: 10.5, letterSpacing: "0.08em", color: DIM, padding: "10px 4px 6px" }}>{(day.label || "").toUpperCase()}</div>
              {day.items.map((mt) => {
                const score = palpiteByMatch.get(mt.id);
                if (!score) return null;
                return (
                  <div key={mt.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 6px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ flex: "0 0 46px", fontFamily: SAIRA, fontWeight: 700, fontSize: 16, color: DIM }}>{fmtTime(mt.startsAt)}</span>
                    <div style={{ flex: "1 1 240px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, minWidth: 0 }}>
                        {!narrow && <span style={{ fontFamily: BRIC, fontSize: 13, color: DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(mt.home.abbreviation, mt.home.name)}</span>}
                        <FlagIcon code={mt.home.abbreviation} size={12} />
                        <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: score.winner === "home" ? LIME : "#f1f7f0" }}>{mt.home.abbreviation}</span>
                      </div>
                      <ScorePill score={score} />
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: score.winner === "away" ? LIME : "#f1f7f0" }}>{mt.away.abbreviation}</span>
                        <FlagIcon code={mt.away.abbreviation} size={12} />
                        {!narrow && <span style={{ fontFamily: BRIC, fontSize: 13, color: DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(mt.away.abbreviation, mt.away.name)}</span>}
                      </div>
                    </div>
                    {!narrow && (
                      <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                        <Confidence value={score.confidence} />
                        <span style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.06em", color: "#54706a" }}>{(groupLabelFor(mt, groupByTeam) || "").toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Projected knockout */}
      <div style={{ fontFamily: JB, fontSize: 11, letterSpacing: "0.1em", color: "#9bb6a6", margin: "4px 4px 8px" }}>
        MATA-MATA PROJETADO
      </div>
      {knockout.length === 0 ? (
        <div style={{ ...card, padding: "28px 24px", textAlign: "center", fontFamily: BRIC, color: DIM }}>
          O mata-mata ainda não foi sorteado — palpites do chaveamento aparecem assim que as chaves saírem.
        </div>
      ) : (
        <div style={{ overflowX: "auto", paddingBottom: 12 }}>
          <div style={{ display: "flex", gap: 18, minWidth: "max-content" }}>
            {knockout.map((col) => (
              <div key={col.slug} style={{ flex: "0 0 250px", display: "flex", flexDirection: "column" }}>
                <div style={{ ...colHead, color: "#9bb6a6" }}>{col.label}</div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                  {col.ties.map((tie) => (
                    <div key={tie.match.id} style={card}>
                      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <BracketSlot team={tie.match.home} advances={tie.advances === tie.match.home.abbreviation} />
                        </div>
                        {tie.score ? <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 14, color: "#fff", padding: "0 11px", flex: "none" }}>{tie.score.home}</span> : null}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <BracketSlot team={tie.match.away} advances={tie.advances === tie.match.away.abbreviation} />
                        </div>
                        {tie.score ? <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 14, color: "#fff", padding: "0 11px", flex: "none" }}>{tie.score.away}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Champion column */}
            <div style={{ flex: "0 0 190px", display: "flex", flexDirection: "column" }}>
              <div style={{ ...colHead, color: LIME }}>Campeão</div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ borderRadius: 14, border: "1px solid rgba(200,255,45,0.45)", background: "linear-gradient(180deg, rgba(200,255,45,0.06), transparent)", boxShadow: "0 0 30px -10px rgba(200,255,45,0.5)", padding: "22px 16px", textAlign: "center" }}>
                  {champion ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                        <FlagCrest code={champion.code} accent={teamAccent(champion.code)} size={56} />
                      </div>
                      <div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 30, lineHeight: 1, color: LIME }}>{champion.code}</div>
                      <div style={{ fontFamily: JB, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9bb6a6", marginTop: 8 }}>palpite da IA</div>
                    </>
                  ) : (
                    <div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 44, lineHeight: 1, color: LIME }}>?</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
