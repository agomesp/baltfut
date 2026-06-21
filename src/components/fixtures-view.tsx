import type { Match } from "@/lib/espn";
import { fmtTime, groupByDay } from "@/lib/format";
import { MONO, DISPLAY, cardStyle } from "@/components/primitives";
import { teamLabel, groupLabelFor, rowTint, teamColor } from "@/components/match-meta";

export interface FixturesViewProps {
  matches: Match[]; // upcoming, sorted ascending by kickoff
  followCode: string | null;
  groupByTeam: Record<string, string>;
}

export function FixturesView({ matches, followCode, groupByTeam }: FixturesViewProps) {
  if (matches.length === 0) {
    return (
      <section>
        <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center", color: "var(--ink-3)" }}>
          Nenhum jogo agendado no momento.
        </div>
      </section>
    );
  }

  const next = matches[0];
  const days = groupByDay(matches);

  return (
    <section>
      <div style={{ ...cardStyle, marginBottom: 32 }}>
        <div style={{ height: 3, background: "var(--signal)" }} />
        <div style={{ padding: "24px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--signal-strong)" }}>Próximo jogo</span>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-2)" }}>{groupLabelFor(next, groupByTeam)}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: "clamp(36px,7vw,56px)", letterSpacing: "-0.025em", lineHeight: 0.98, color: teamColor(next.home.abbreviation, followCode) }}>{next.home.abbreviation}</div>
              <div style={{ fontSize: 15, color: "var(--ink-2)", marginTop: 4 }}>{teamLabel(next.home.abbreviation, next.home.name)}</div>
            </div>
            <div style={{ textAlign: "center", padding: "0 8px" }}>
              <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.10em", color: "var(--ink-3)" }}>VS</div>
              <div style={{ fontFamily: MONO, fontSize: 18, marginTop: 6, color: "var(--ink)" }}>{fmtTime(next.startsAt)}</div>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: "clamp(36px,7vw,56px)", letterSpacing: "-0.025em", lineHeight: 0.98, color: teamColor(next.away.abbreviation, followCode) }}>{next.away.abbreviation}</div>
              <div style={{ fontSize: 15, color: "var(--ink-2)", marginTop: 4 }}>{teamLabel(next.away.abbreviation, next.away.name)}</div>
            </div>
          </div>
          <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-2)" }}>{days[0].label}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-2)" }}>{next.venue ?? ""}</span>
          </div>
        </div>
      </div>

      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-2)", marginBottom: 14 }}>Próximos jogos</div>
      {days.map((day) => (
        <div key={day.key} style={{ marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink)" }}>{day.label}</span>
            <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>
          {day.items.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "11px 4px", borderBottom: "1px solid var(--line)", background: rowTint(m, followCode) }}>
              <span style={{ flex: "0 0 52px", fontFamily: MONO, fontSize: 13, color: "var(--ink-2)" }}>{fmtTime(m.startsAt)}</span>
              <div style={{ flex: "1 1 240px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
                <div style={{ textAlign: "right", minWidth: 0 }}>
                  <span style={{ fontSize: 15, color: "var(--ink-2)" }}>{teamLabel(m.home.abbreviation, m.home.name)}</span>{" "}
                  <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 15, color: teamColor(m.home.abbreviation, followCode) }}>{m.home.abbreviation}</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--ink-3)" }}>vs</span>
                <div style={{ textAlign: "left", minWidth: 0 }}>
                  <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 15, color: teamColor(m.away.abbreviation, followCode) }}>{m.away.abbreviation}</span>{" "}
                  <span style={{ fontSize: 15, color: "var(--ink-2)" }}>{teamLabel(m.away.abbreviation, m.away.name)}</span>
                </div>
              </div>
              <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                {[groupLabelFor(m, groupByTeam), m.venue].filter(Boolean).join(" · ")}
              </span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
