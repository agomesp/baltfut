import type { Match } from "@/lib/espn";
import { groupByDay, scoreText } from "@/lib/format";
import { MONO, DISPLAY, cardStyle } from "@/components/primitives";
import { teamLabel, groupLabelFor, rowTint } from "@/components/match-meta";

export interface ResultsViewProps {
  matches: Match[]; // finished, sorted descending by kickoff
  followCode: string | null;
  groupByTeam: Record<string, string>;
}

export function ResultsView({ matches, followCode, groupByTeam }: ResultsViewProps) {
  if (matches.length === 0) {
    return (
      <section>
        <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center", color: "var(--ink-3)" }}>
          Nenhum resultado ainda.
        </div>
      </section>
    );
  }

  const days = groupByDay(matches);

  return (
    <section>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-2)", marginBottom: 14 }}>
        Resultados · mais recentes
      </div>
      {days.map((day) => (
        <div key={day.key} style={{ marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink)" }}>{day.label}</span>
            <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>
          {day.items.map((m) => {
            const hs = m.homeScore ?? 0;
            const as = m.awayScore ?? 0;
            const homeWin = hs > as;
            const awayWin = as > hs;
            const homeCode = m.home.abbreviation === followCode ? "var(--signal-strong)" : homeWin ? "var(--ink)" : "var(--ink-3)";
            const awayCode = m.away.abbreviation === followCode ? "var(--signal-strong)" : awayWin ? "var(--ink)" : "var(--ink-3)";
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "11px 4px", borderBottom: "1px solid var(--line)", background: rowTint(m, followCode) }}>
                <span style={{ flex: "0 0 52px", fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>{groupLabelFor(m, groupByTeam)}</span>
                <div style={{ flex: "1 1 240px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "right", minWidth: 0 }}>
                    <span style={{ fontSize: 15, color: homeWin ? "var(--ink)" : "var(--ink-2)" }}>{teamLabel(m.home.abbreviation, m.home.name)}</span>{" "}
                    <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 15, color: homeCode }}>{m.home.abbreviation}</span>
                  </div>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 20, letterSpacing: "-0.012em", color: "var(--ink)", minWidth: 54, textAlign: "center" }}>{scoreText(m) || "—"}</span>
                  <div style={{ textAlign: "left", minWidth: 0 }}>
                    <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 15, color: awayCode }}>{m.away.abbreviation}</span>{" "}
                    <span style={{ fontSize: 15, color: awayWin ? "var(--ink)" : "var(--ink-2)" }}>{teamLabel(m.away.abbreviation, m.away.name)}</span>
                  </div>
                </div>
                <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>{m.venue ?? ""}</span>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
