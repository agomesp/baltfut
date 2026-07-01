"use client";

import { useMemo } from "react";
import type { Group, Match } from "@/lib/espn";
import {
  buildAiPalpites,
  type ScorePalpite,
  type SimTie,
  type SimTeam,
} from "@/lib/ai-palpite";
import { fmtTime, groupByDay } from "@/lib/format";
import { teamNamePt } from "@/lib/team-names";
import { useIsNarrow } from "@/lib/use-is-narrow";
import { groupLabelFor } from "@/components/match-meta";
import { ConnectedBracket } from "@/components/connected-bracket";
import {
  BRIC,
  JB,
  SAIRA,
  LIME,
  GOLD,
  GOLD_DEEP,
  DIM,
  DIM_2,
  FlagIcon,
  FlagCrest,
  ViewHeader,
  teamAccent,
} from "@/components/live/bf-ui";

export interface AiPalpitesViewProps {
  matches: Match[];
  groups: Group[];
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

/** One side of a simulated tie: flag + code + name + goals. The advancing side is
 *  tinted `accent` (lime for a live pick, muted grey when the real result refuted
 *  my pick) with a ▸; predicted (not-yet-decided) sides render in italic. `pens`
 *  is the real shootout tally; `penMark` shows my projected-on-penalties call. */
function SimSlot({ team, goals, advances, accent, pens, penMark }: { team: SimTeam; goals: number; advances: boolean; accent: string; pens: number | null; penMark: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", opacity: advances ? 1 : 0.6 }}>
      <FlagIcon code={team.code} size={12} />
      <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 13, color: advances ? accent : "#f1f7f0", fontStyle: team.projected ? "italic" : "normal" }}>{team.code}</span>
      <span style={{ fontFamily: BRIC, fontSize: 11, color: DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontStyle: team.projected ? "italic" : "normal" }}>{teamNamePt(team.code, team.name)}</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, flex: "none" }}>
        {advances ? <span style={{ fontFamily: JB, fontSize: 9, color: accent }}>▸</span> : null}
        <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 14, color: advances ? "#fff" : "#7d9a86" }}>
          {goals}
          {pens != null ? <span style={{ fontFamily: JB, fontSize: 9, color: GOLD_DEEP, marginLeft: 2 }}>({pens})</span> : null}
          {penMark && advances ? <span style={{ fontFamily: JB, fontSize: 8, color: accent, verticalAlign: "super" }}> p</span> : null}
        </span>
      </span>
    </div>
  );
}

/** Footer tag under a finished tie: a lime "acertei" when I called it right, or a
 *  grey "errei" (with the side I wrongly backed) when the pitch refuted me. */
function TieVerdict({ tie }: { tie: SimTie }) {
  const predictedCode = tie.predictedWinner === "home" ? tie.home.code : tie.away.code;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px 6px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      {tie.miss ? (
        <>
          <span style={{ fontFamily: JB, fontSize: 8.5, letterSpacing: "0.06em", color: GOLD }}>✕ IA ERROU</span>
          <span style={{ fontFamily: JB, fontSize: 8.5, letterSpacing: "0.04em", color: "#6f8a78" }}>· previu {predictedCode}</span>
        </>
      ) : (
        <span style={{ fontFamily: JB, fontSize: 8.5, letterSpacing: "0.06em", color: LIME }}>✓ IA ACERTOU</span>
      )}
    </div>
  );
}

/** A simulated tie card (two stacked slots). A finished tie shows its real result;
 *  one the model got wrong is dimmed to grey so the error reads at a glance. */
function TieCard({ tie }: { tie: SimTie }) {
  const miss = tie.decided && tie.miss;
  const hit = tie.decided && !tie.miss;
  // Real winner on a miss is shown muted (I didn't back it), lime otherwise.
  const accent = miss ? "#c5d0c8" : LIME;
  const penMark = !tie.decided && tie.penalties; // projected-on-pens marker
  return (
    <div style={{ ...card, opacity: miss ? 0.6 : 1, borderColor: miss ? "rgba(255,255,255,0.05)" : hit ? "rgba(200,255,45,0.2)" : "rgba(255,255,255,0.08)" }}>
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <SimSlot team={tie.home} goals={tie.homeGoals} advances={tie.winner === "home"} accent={accent} pens={tie.homePens} penMark={penMark} />
      </div>
      <SimSlot team={tie.away} goals={tie.awayGoals} advances={tie.winner === "away"} accent={accent} pens={tie.awayPens} penMark={penMark} />
      {tie.decided ? <TieVerdict tie={tie} /> : null}
    </div>
  );
}

export function AiPalpitesView({ matches, groups, groupByTeam }: AiPalpitesViewProps) {
  const narrow = useIsNarrow();
  const model = useMemo(() => buildAiPalpites(matches, groups), [matches, groups]);
  const { upcoming, bracket, champion, ranking } = model;

  const days = useMemo(() => groupByDay(upcoming.map((u) => u.match)), [upcoming]);
  const palpiteByMatch = useMemo(
    () => new Map(upcoming.map((u) => [u.match.id, u.score])),
    [upcoming],
  );

  return (
    <section>
      <ViewHeader label="// AI PALPITES" sub="previsões da IA do BaltFut · placar, mata-mata completo e campeão · geradas por força das seleções" />

      {/* Entertainment-only disclaimer. The projections are a deterministic
          strength model, not betting tips — make that explicit up front. */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 2px", marginBottom: 12 }}>
        <span aria-hidden style={{ fontSize: 9, flex: "none" }}>⚠️</span>
        <span style={{ fontFamily: JB, fontSize: 8.5, lineHeight: 1.5, letterSpacing: "0.02em", color: `${GOLD}cc` }}>
          <strong>Apenas diversão</strong> · projeção automática por força das seleções — não é conselho de apostas nem garantia de resultado.
        </span>
      </div>

      {/* Projected knockout — full simulation (lead element of the screen) */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", margin: "4px 4px 8px" }}>
        <span style={{ fontFamily: JB, fontSize: 11, letterSpacing: "0.1em", color: "#9bb6a6" }}>MATA-MATA PROJETADO</span>
        <span style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.04em", color: DIM_2 }}>▸ avança · itálico = previsão · ᵖ = pênaltis · <span style={{ color: "#c5d0c8" }}>cinza = IA errou (resultado real)</span></span>
      </div>
      {bracket.columns.length === 0 ? (
        <div style={{ ...card, padding: "28px 24px", textAlign: "center", fontFamily: BRIC, color: DIM, marginBottom: 26 }}>
          O mata-mata ainda não foi sorteado — a projeção aparece assim que as chaves saírem.
        </div>
      ) : (
        <div style={{ overflowX: "auto", paddingBottom: 12, marginBottom: 26 }}>
          <ConnectedBracket
            rounds={bracket.columns.map((col) => ({
              key: col.slug,
              label: <div style={{ ...colHead, color: col.slug === "final" ? LIME : "#9bb6a6" }}>{col.label}</div>,
              items: col.ties.map((tie) => <TieCard key={tie.id} tie={tie} />),
            }))}
            colWidth={248}
            unitHeight={108}
            gap={24}
            trailing={{
              width: 190,
              label: <div style={{ ...colHead, color: LIME }}>Campeão</div>,
              content: (
                <>
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
                  {bracket.thirdPlace ? (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ ...colHead, color: "#9bb6a6" }}>3º lugar</div>
                      <TieCard tie={bracket.thirdPlace} />
                    </div>
                  ) : null}
                </>
              ),
            }}
          />
        </div>
      )}

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
              {bracket.runnerUp && bracket.third ? (
                <div style={{ fontFamily: JB, fontSize: 9.5, letterSpacing: "0.04em", color: DIM_2, marginTop: 10, lineHeight: 1.6 }}>
                  VICE <span style={{ color: "#cfd9d1" }}>{bracket.runnerUp.code}</span> · 3º <span style={{ color: "#cfd9d1" }}>{bracket.third.code}</span>
                </div>
              ) : null}
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
    </section>
  );
}
