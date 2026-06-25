"use client";

import type { Match } from "@/lib/espn";
import { groupByDay } from "@/lib/format";
import { teamNamePt } from "@/lib/team-names";
import { useIsNarrow } from "@/lib/use-is-narrow";
import { groupLabelFor } from "@/components/match-meta";
import { BRIC, JB, SAIRA, LIME, FlagIcon, ViewHeader } from "@/components/live/bf-ui";

export interface ResultsViewProps {
  matches: Match[]; // finished, sorted descending by kickoff
  followCode: string | null;
  groupByTeam: Record<string, string>;
}

export function ResultsView({ matches, followCode, groupByTeam }: ResultsViewProps) {
  const narrow = useIsNarrow();
  if (matches.length === 0) {
    return (
      <section>
        <ViewHeader label="// RESULTADOS" sub="mais recentes" />
        <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "40px 24px", textAlign: "center", fontFamily: BRIC, color: "#7d9a86" }}>
          Nenhum resultado ainda.
        </div>
      </section>
    );
  }

  const days = groupByDay(matches);

  return (
    <section>
      <ViewHeader label="// RESULTADOS" sub="mais recentes" />

      {days.map((day) => (
        <div key={day.key} style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: JB, fontSize: 11, letterSpacing: "0.08em", color: "#9bb6a6", padding: "10px 4px 6px" }}>{(day.label || "").toUpperCase()}</div>
          {day.items.map((m) => {
            const hs = m.homeScore ?? 0;
            const as = m.awayScore ?? 0;
            const homeWin = hs > as;
            const awayWin = as > hs;
            const homeCode = m.home.abbreviation === followCode ? LIME : homeWin ? "#f1f7f0" : "#6f8a78";
            const awayCode = m.away.abbreviation === followCode ? LIME : awayWin ? "#f1f7f0" : "#6f8a78";
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 6px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                {/* Group + venue labels are dropped on a phone so the teams + score
                    fill the row without overlap. */}
                {!narrow && <span style={{ flex: "0 0 70px", fontFamily: JB, fontSize: 9.5, letterSpacing: "0.06em", color: "#6f8a78" }}>{(groupLabelFor(m, groupByTeam) || "").toUpperCase()}</span>}
                <div style={{ flex: "1 1 240px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, minWidth: 0 }}>
                    <span style={{ fontFamily: BRIC, fontSize: 14, color: homeWin ? "#cfd9d1" : "#7d9a86", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(m.home.abbreviation, m.home.name)}</span>
                    <FlagIcon code={m.home.abbreviation} size={13} />
                    <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: homeCode }}>{m.home.abbreviation}</span>
                  </div>
                  <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 26, color: "#fff", minWidth: 64, textAlign: "center", lineHeight: 0.9, whiteSpace: "nowrap" }}>
                    <span style={{ color: homeWin ? "#fff" : "#9bb6a6" }}>{hs}</span>
                    <span style={{ color: "#42565b", margin: "0 8px" }}>–</span>
                    <span style={{ color: awayWin ? "#fff" : "#9bb6a6" }}>{as}</span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: awayCode }}>{m.away.abbreviation}</span>
                    <FlagIcon code={m.away.abbreviation} size={13} />
                    <span style={{ fontFamily: BRIC, fontSize: 14, color: awayWin ? "#cfd9d1" : "#7d9a86", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(m.away.abbreviation, m.away.name)}</span>
                  </div>
                </div>
                {!narrow && <span style={{ flex: "0 0 auto", fontFamily: JB, fontSize: 9.5, letterSpacing: "0.06em", color: "#6f8a78", textAlign: "right" }}>{(m.venue ?? "").toUpperCase()}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
