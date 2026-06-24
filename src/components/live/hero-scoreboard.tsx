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
        <span style={{ width: 20, height: 20, borderRadius: "50%", background: ev.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, boxShadow: "0 0 0 3px #061509" }}>⚽</span>
      ) : (
        <span style={{ width: 13, height: 17, borderRadius: 3, background: ev.color, boxShadow: "0 0 0 3px #061509" }} />
      )}
      {withLabel ? (
        <span style={{ fontFamily: JB, fontSize: 9, color: "#8fa898", marginTop: 6, whiteSpace: "nowrap" }}>{ev.minLabel}</span>
      ) : null}
    </div>
  );
}

function TeamBlock({ code, accent, name, crestSize }: { code: string; accent: string; name: string; crestSize: number }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <FlagCrest code={code} accent={accent} size={crestSize} />
      <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(18px,2.3vw,30px)", letterSpacing: "-0.02em", color: accent, textAlign: "center", lineHeight: 1, whiteSpace: "nowrap" }}>
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
  const crestSize = compact ? 74 : 92;
  const scoreFont = compact ? "clamp(44px,6vw,72px)" : "clamp(56px,9vw,104px)";

  return (
    <div style={{ position: "relative", flex: "none", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(200,255,45,0.12)", background: "linear-gradient(180deg, rgba(200,255,45,0.04), transparent)", padding: compact ? "26px 20px 14px" : "34px 24px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(16px,3vw,30px)" }}>
        <TeamBlock code={match.home.abbreviation} accent={homeAccent} name={teamNamePt(match.home.abbreviation, match.home.name)} crestSize={crestSize} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, flex: "none" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: JB, fontSize: 13, fontWeight: 600, color: LIME, background: "rgba(200,255,45,0.12)", border: "1px solid rgba(200,255,45,0.38)", borderRadius: 999, padding: "5px 13px", whiteSpace: "nowrap" }}>
            <BfPulse />
            {matchClockLabel(match)}
          </span>
          {pre ? (
            <div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: "clamp(28px,4vw,46px)", color: "#fff", lineHeight: 0.9 }}>VS</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: scoreFont, lineHeight: 0.74, color: "#fff" }}>{match.homeScore ?? 0}</span>
              <span style={{ width: 28, height: 6, borderRadius: 4, background: LIME, boxShadow: "0 0 14px rgba(200,255,45,0.5)", flex: "0 0 auto" }} />
              <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: scoreFont, lineHeight: 0.74, color: "#fff" }}>{match.awayScore ?? 0}</span>
            </div>
          )}
        </div>

        <TeamBlock code={match.away.abbreviation} accent={awayAccent} name={teamNamePt(match.away.abbreviation, match.away.name)} crestSize={crestSize} />
      </div>

      {events.length > 0 ? (
        <div style={{ maxWidth: 620, margin: "18px auto 0" }}>
          <div style={{ position: "relative", height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, margin: "0 4px" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: elapsedPct(match), background: "linear-gradient(90deg,#3a7d2c,#c8ff2d)", borderRadius: 2 }} />
            {events.map((ev, i) => (
              <Marker key={i} ev={ev} withLabel />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 16 }}>
            {events.map((ev, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: JB, fontSize: 10, color: "#aebdb4", padding: "4px 9px", borderRadius: 999, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: ev.color }} />
                {ev.minLabel} {ev.player}
                {ev.kind === "goal" ? "" : ev.kind === "red" ? " 🟥" : ""}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
