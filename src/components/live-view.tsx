import type { CSSProperties } from "react";
import type { Match, MatchLineups, TeamLineup } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import { MONO, DISPLAY, cardStyle, PulseDot } from "@/components/primitives";
import { PredictionPanel } from "@/components/prediction-panel";
import { teamLabel } from "@/components/match-meta";

function groupLabel(m: Match, groupByTeam: Record<string, string>): string {
  const g = groupByTeam[m.home.abbreviation] ?? groupByTeam[m.away.abbreviation];
  return g ? `Grupo ${g}` : "";
}

function segBtn(active: boolean): CSSProperties {
  return {
    flex: "1 1 0",
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    background: active ? "var(--signal)" : "transparent",
    color: active ? "var(--signal-ink)" : "var(--ink-2)",
    border: `1px solid ${active ? "var(--signal)" : "var(--line-2)"}`,
    borderRadius: 999,
    padding: "8px",
    cursor: "pointer",
  };
}

function LineupBlock({ team, followCode }: { team: TeamLineup; followCode: string | null }) {
  const followed = team.code === followCode;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 19, letterSpacing: "-0.012em", color: followed ? "var(--signal-strong)" : "var(--ink)" }}>
          {team.code}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", color: "var(--ink-3)", whiteSpace: "nowrap" }}>{team.formation}</span>
      </div>
      {team.players.map((p, i) => (
        <div key={`${p.number}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: "1px solid var(--line)" }}>
          <span style={{ flex: "0 0 22px", fontFamily: MONO, fontSize: 12, color: "var(--signal-strong)", textAlign: "right" }}>{p.number}</span>
          <span style={{ flex: "0 0 26px", fontFamily: MONO, fontSize: 10, letterSpacing: "0.04em", color: "var(--ink-3)" }}>{p.pos}</span>
          <span style={{ flex: "1 1 auto", fontSize: 13, color: "var(--ink)" }}>{p.name}</span>
        </div>
      ))}
    </div>
  );
}

function LineupPanel({ lineups, followCode }: { lineups: MatchLineups | null; followCode: string | null }) {
  if (!lineups) {
    return (
      <div style={{ padding: "20px 18px", fontSize: 13, color: "var(--ink-3)" }}>
        Escalações ainda não divulgadas.
      </div>
    );
  }
  return (
    <div style={{ flex: "1 1 auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", maxHeight: 580 }}>
      <LineupBlock team={lineups.home} followCode={followCode} />
      <LineupBlock team={lineups.away} followCode={followCode} />
    </div>
  );
}

function BigDetail({ match, followCode, groupByTeam }: { match: Match; followCode: string | null; groupByTeam: Record<string, string> }) {
  const minute = match.displayClock || match.statusDetail || "";
  const homeColor = match.home.abbreviation === followCode ? "var(--signal-strong)" : "var(--ink)";
  const awayColor = match.away.abbreviation === followCode ? "var(--signal-strong)" : "var(--ink)";
  const homeGoals = match.goals.filter((g) => g.side === "home");
  const awayGoals = match.goals.filter((g) => g.side === "away");
  const meta = [groupLabel(match, groupByTeam), match.venue].filter(Boolean).join(" · ");

  return (
    <div style={{ ...cardStyle, flex: "2 1 440px" }}>
      <div style={{ height: 4, background: "var(--signal)" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 24px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 12, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--signal-strong)" }}>
          <PulseDot size={8} />
          Ao vivo · {minute}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-2)" }}>{meta}</span>
      </div>
      <div style={{ minHeight: "min(560px,62vh)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "clamp(36px,6vw,64px) 24px", gap: 40 }}>
        <div style={{ width: "100%", maxWidth: 920, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "clamp(16px,4vw,48px)" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: "clamp(38px,6.5vw,96px)", letterSpacing: "-0.03em", lineHeight: 0.92, color: homeColor }}>{match.home.abbreviation}</div>
            <div style={{ fontSize: "clamp(15px,2vw,22px)", color: "var(--ink-2)", marginTop: 8 }}>{teamLabel(match.home.abbreviation, match.home.name)}</div>
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: "clamp(44px,7.5vw,108px)", letterSpacing: "-0.02em", lineHeight: 0.9, whiteSpace: "nowrap", color: "var(--ink)", textAlign: "center" }}>
            {match.homeScore ?? 0}–{match.awayScore ?? 0}
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: "clamp(38px,6.5vw,96px)", letterSpacing: "-0.03em", lineHeight: 0.92, color: awayColor }}>{match.away.abbreviation}</div>
            <div style={{ fontSize: "clamp(15px,2vw,22px)", color: "var(--ink-2)", marginTop: 8 }}>{teamLabel(match.away.abbreviation, match.away.name)}</div>
          </div>
        </div>
        {match.goals.length > 0 ? (
          <div style={{ width: "100%", maxWidth: 920, paddingTop: 28, borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {homeGoals.map((g, i) => (
                <span key={i} style={{ fontFamily: MONO, fontSize: 15, color: "var(--ink)" }}>
                  <span style={{ color: "var(--signal-strong)" }}>{g.clock}</span> {g.scorer}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "right" }}>
              {awayGoals.map((g, i) => (
                <span key={i} style={{ fontFamily: MONO, fontSize: 15, color: "var(--ink)" }}>
                  {g.scorer} <span style={{ color: "var(--signal-strong)" }}>{g.clock}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface LiveViewProps {
  liveMatches: Match[];
  selected: number;
  onSelect: (i: number) => void;
  panel: "predict" | "lineup";
  onPanel: (p: "predict" | "lineup") => void;
  lineups: MatchLineups | null;
  entries: VoteEntry[];
  onVoted: () => void;
  followCode: string | null;
  groupByTeam: Record<string, string>;
}

export function LiveView({
  liveMatches,
  selected,
  onSelect,
  panel,
  onPanel,
  lineups,
  entries,
  onVoted,
  followCode,
  groupByTeam,
}: LiveViewProps) {
  const selectedMatch = liveMatches[selected] ?? liveMatches[0];

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: MONO, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--signal-strong)" }}>
          <PulseDot />
          Ao vivo agora
        </span>
        <span style={{ fontSize: 14, color: "var(--ink-3)" }}>
          {liveMatches.length} {liveMatches.length === 1 ? "partida em andamento" : "partidas em andamento"} · o placar atualiza a cada gol.
        </span>
      </div>

      {!selectedMatch ? (
        <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 24, letterSpacing: "-0.012em", color: "var(--ink-2)" }}>Nenhuma partida em andamento</div>
          <div style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 8 }}>Veja os próximos jogos na aba Jogos.</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
            {liveMatches.map((m, i) => {
              const active = i === selected;
              return (
                <button
                  key={m.id}
                  onClick={() => onSelect(i)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 13, letterSpacing: "0.02em", background: active ? "var(--signal)" : "transparent", color: active ? "var(--signal-ink)" : "var(--ink-2)", border: `1px solid ${active ? "var(--signal)" : "var(--line-2)"}`, borderRadius: 999, padding: "8px 14px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  <PulseDot size={6} color={active ? "var(--signal-ink)" : "var(--signal)"} />
                  {m.home.abbreviation} {m.homeScore ?? 0}–{m.awayScore ?? 0} {m.away.abbreviation}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
            <div style={{ ...cardStyle, flex: "1 1 280px", minWidth: 260, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", gap: 8, padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
                <button onClick={() => onPanel("predict")} style={segBtn(panel === "predict")}>Palpite</button>
                <button onClick={() => onPanel("lineup")} style={segBtn(panel === "lineup")}>Escalação</button>
              </div>
              {panel === "predict" ? (
                <PredictionPanel
                  match={selectedMatch}
                  entries={entries}
                  current={{ home: selectedMatch.homeScore ?? 0, away: selectedMatch.awayScore ?? 0 }}
                  onVoted={onVoted}
                />
              ) : (
                <LineupPanel lineups={lineups} followCode={followCode} />
              )}
            </div>

            <BigDetail match={selectedMatch} followCode={followCode} groupByTeam={groupByTeam} />
          </div>
        </>
      )}
    </section>
  );
}
