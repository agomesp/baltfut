import type { Match } from "@/lib/espn";
import { teamNamePt } from "@/lib/team-names";
import {
  BRIC,
  BfPulse,
  buildTimeline,
  elapsedPct,
  FlagCrest,
  JB,
  LIME,
  matchClockLabel,
  SAIRA,
  teamAccent,
  type TimelineEvent,
} from "@/components/live/bf-ui";

/** A goal (lime/team circle with ⚽) or a card (small colored rect) on the track. */
function Marker({ ev, withLabel }: { ev: TimelineEvent; withLabel: boolean }) {
  return (
    <div style={{ position: "absolute", top: "50%", left: ev.leftPct, transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {ev.kind === "goal" ? (
        <span style={{ width: 16, height: 16, borderRadius: "50%", background: ev.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, boxShadow: "0 0 0 3px #061509" }}>⚽</span>
      ) : (
        <span style={{ width: 11, height: 14, borderRadius: 3, background: ev.color, boxShadow: "0 0 0 3px #061509" }} />
      )}
      {withLabel ? (
        <span style={{ fontFamily: JB, fontSize: 8.5, color: "#8fa898", marginTop: 5, whiteSpace: "nowrap" }}>{ev.minLabel}</span>
      ) : null}
    </div>
  );
}

function TeamBlock({ code, accent, name, crestSize }: { code: string; accent: string; name: string; crestSize: number }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
      <FlagCrest code={code} accent={accent} size={crestSize} />
      <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(15px,1.9vw,24px)", letterSpacing: "-0.02em", color: accent, textAlign: "center", lineHeight: 1, whiteSpace: "nowrap" }}>
        {name.toUpperCase()}
      </div>
    </div>
  );
}

export interface HeroScoreboardProps {
  match: Match;
  /** Pre-match shows kickoff time instead of a score and hides the timeline. */
  pre?: boolean;
  /** Smaller hero for narrower columns. */
  compact?: boolean;
}

export function HeroScoreboard({ match, pre = false, compact = false }: HeroScoreboardProps) {
  const homeAccent = teamAccent(match.home.abbreviation);
  const awayAccent = teamAccent(match.away.abbreviation);
  const events = pre ? [] : buildTimeline(match, homeAccent, awayAccent);
  const crestSize = compact ? 58 : 74;
  const scoreFont = compact ? "clamp(34px,4.5vw,56px)" : "clamp(46px,6.5vw,84px)";

  return (
    <div style={{ position: "relative", flex: "none", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(200,255,45,0.12)", background: "linear-gradient(180deg, rgba(200,255,45,0.04), transparent)", padding: compact ? "16px 18px 10px" : "22px 22px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(12px,2.2vw,24px)" }}>
        <TeamBlock code={match.home.abbreviation} accent={homeAccent} name={teamNamePt(match.home.abbreviation, match.home.name)} crestSize={crestSize} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flex: "none" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: JB, fontSize: 11.5, fontWeight: 600, color: LIME, background: "rgba(200,255,45,0.12)", border: "1px solid rgba(200,255,45,0.38)", borderRadius: 999, padding: "4px 11px", whiteSpace: "nowrap" }}>
            <BfPulse />
            {matchClockLabel(match)}
          </span>
          {pre ? (
            <div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: "clamp(24px,3.5vw,40px)", color: "#fff", lineHeight: 0.9 }}>VS</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: scoreFont, lineHeight: 0.74, color: "#fff" }}>{match.homeScore ?? 0}</span>
              <span style={{ width: 22, height: 5, borderRadius: 4, background: LIME, boxShadow: "0 0 14px rgba(200,255,45,0.5)", flex: "0 0 auto" }} />
              <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: scoreFont, lineHeight: 0.74, color: "#fff" }}>{match.awayScore ?? 0}</span>
            </div>
          )}
        </div>

        <TeamBlock code={match.away.abbreviation} accent={awayAccent} name={teamNamePt(match.away.abbreviation, match.away.name)} crestSize={crestSize} />
      </div>

      {events.length > 0 ? (
        <div style={{ maxWidth: 580, margin: "12px auto 0" }}>
          <div style={{ position: "relative", height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, margin: "0 4px" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: elapsedPct(match), background: "linear-gradient(90deg,#3a7d2c,#c8ff2d)", borderRadius: 2 }} />
            {events.map((ev, i) => (
              <Marker key={i} ev={ev} withLabel />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 10 }}>
            {events.map((ev, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: JB, fontSize: 9.5, color: "#aebdb4", padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: ev.color }} />
                {ev.minLabel} {ev.player}
                {ev.kind === "red" ? " 🟥" : ""}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
