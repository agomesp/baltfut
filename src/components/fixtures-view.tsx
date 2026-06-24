import type { Match } from "@/lib/espn";
import { fmtTime, groupByDay } from "@/lib/format";
import { teamNamePt } from "@/lib/team-names";
import { groupLabelFor } from "@/components/match-meta";
import { BRIC, JB, SAIRA, LIME, FlagIcon, ViewHeader } from "@/components/live/bf-ui";

export interface FixturesViewProps {
  matches: Match[]; // upcoming, sorted ascending by kickoff
  followCode: string | null;
  groupByTeam: Record<string, string>;
}

function codeColor(code: string, followCode: string | null): string {
  return code === followCode ? LIME : "#f1f7f0";
}

export function FixturesView({ matches, followCode, groupByTeam }: FixturesViewProps) {
  if (matches.length === 0) {
    return (
      <section>
        <ViewHeader label="// JOGOS" sub="próximo jogo e calendário · horário de Brasília" />
        <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "40px 24px", textAlign: "center", fontFamily: BRIC, color: "#7d9a86" }}>
          Nenhum jogo agendado no momento.
        </div>
      </section>
    );
  }

  const next = matches[0];
  const days = groupByDay(matches);

  return (
    <section>
      <ViewHeader label="// JOGOS" sub="próximo jogo e calendário · horário de Brasília" />

      {/* PRÓXIMO JOGO hero */}
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(200,255,45,0.2)", background: "linear-gradient(180deg, rgba(200,255,45,0.05), transparent)", padding: "20px 26px", marginBottom: 26 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 2, background: "linear-gradient(90deg,#3a7d2c,#c8ff2d)", boxShadow: "0 0 14px rgba(200,255,45,0.5)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontFamily: JB, fontSize: 10.5, letterSpacing: "0.16em", color: LIME }}>PRÓXIMO JOGO</span>
          <span style={{ fontFamily: JB, fontSize: 10.5, letterSpacing: "0.08em", color: "#7d9a86" }}>{(groupLabelFor(next, groupByTeam) || "").toUpperCase()}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 18 }}>
          <div style={{ textAlign: "right", minWidth: 0 }}>
            <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(34px,5vw,52px)", letterSpacing: "-0.02em", lineHeight: 0.95, color: codeColor(next.home.abbreviation, followCode) }}>{next.home.abbreviation}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, marginTop: 6 }}>
              <FlagIcon code={next.home.abbreviation} size={13} />
              <span style={{ fontFamily: BRIC, fontSize: 13, color: "#9bb6a6" }}>{teamNamePt(next.home.abbreviation, next.home.name)}</span>
            </div>
          </div>
          <div style={{ textAlign: "center", padding: "0 4px" }}>
            <div style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.16em", color: "#6f8a78" }}>VS</div>
            <div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: "clamp(28px,4vw,44px)", color: LIME, lineHeight: 0.9, marginTop: 4 }}>{fmtTime(next.startsAt)}</div>
          </div>
          <div style={{ textAlign: "left", minWidth: 0 }}>
            <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(34px,5vw,52px)", letterSpacing: "-0.02em", lineHeight: 0.95, color: codeColor(next.away.abbreviation, followCode) }}>{next.away.abbreviation}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
              <FlagIcon code={next.away.abbreviation} size={13} />
              <span style={{ fontFamily: BRIC, fontSize: 13, color: "#9bb6a6" }}>{teamNamePt(next.away.abbreviation, next.away.name)}</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.08em", color: "#7d9a86" }}>{(days[0].label || "").toUpperCase()}</span>
          <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.08em", color: "#7d9a86" }}>{(next.venue ?? "").toUpperCase()}</span>
        </div>
      </div>

      {/* schedule grouped by day */}
      {days.map((day) => (
        <div key={day.key} style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: JB, fontSize: 11, letterSpacing: "0.08em", color: "#9bb6a6", padding: "10px 4px 6px" }}>{(day.label || "").toUpperCase()}</div>
          {day.items.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 6px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ flex: "0 0 52px", fontFamily: SAIRA, fontWeight: 700, fontSize: 18, color: "#f1f7f0" }}>{fmtTime(m.startsAt)}</span>
              <div style={{ flex: "1 1 240px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, minWidth: 0 }}>
                  <span style={{ fontFamily: BRIC, fontSize: 14, color: "#9bb6a6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(m.home.abbreviation, m.home.name)}</span>
                  <FlagIcon code={m.home.abbreviation} size={13} />
                  <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: codeColor(m.home.abbreviation, followCode) }}>{m.home.abbreviation}</span>
                </div>
                <span style={{ fontFamily: JB, fontSize: 11, color: "#6f8a78" }}>vs</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: codeColor(m.away.abbreviation, followCode) }}>{m.away.abbreviation}</span>
                  <FlagIcon code={m.away.abbreviation} size={13} />
                  <span style={{ fontFamily: BRIC, fontSize: 14, color: "#9bb6a6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(m.away.abbreviation, m.away.name)}</span>
                </div>
              </div>
              <span style={{ flex: "0 0 auto", fontFamily: JB, fontSize: 9.5, letterSpacing: "0.06em", color: "#6f8a78", textAlign: "right" }}>
                {[groupLabelFor(m, groupByTeam), m.venue].filter(Boolean).join(" · ").toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
