import type { Match, MatchSub } from "@/lib/espn";
import { matchShootout } from "@/lib/espn";
import { SwitchingCrest } from "@/components/live/switching-crest";
import { SquadWall } from "@/components/live/squad-wall";
import { resolveCraquePair, type CraqueBase } from "@/data/craque-map";
import {
  BRIC,
  BfPulse,
  buildTimeline,
  GOLD_DEEP,
  JB,
  LIME,
  matchClockLabel,
  SAIRA,
  teamAccent,
  type TimelineEvent,
} from "@/components/live/bf-ui";
import { TimelineFill } from "@/components/live/timeline-bar";

/** A goal (⚽ circle), a card (colored rect), or a substitution (⇄ ring) marker. */
function Marker({ ev, withLabel }: { ev: TimelineEvent; withLabel: boolean }) {
  return (
    <div style={{ position: "absolute", top: "50%", left: ev.leftPct, transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", opacity: ev.kind === "sub" ? 0.5 : 1 }}>
      {ev.kind === "goal" ? (
        <span style={{ width: 16, height: 16, borderRadius: "50%", background: ev.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, boxShadow: "0 0 0 3px #061509" }}>⚽</span>
      ) : ev.kind === "sub" ? (
        <span style={{ width: 15, height: 15, borderRadius: "50%", background: "#0b1c0e", border: `1.5px solid ${ev.color}`, color: ev.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, boxShadow: "0 0 0 3px #061509" }}>⇄</span>
      ) : (
        <span style={{ width: 11, height: 14, borderRadius: 3, background: ev.color, boxShadow: "0 0 0 3px #061509" }} />
      )}
      {withLabel ? (
        <span style={{ fontFamily: JB, fontSize: 8.5, color: "#8fa898", marginTop: 5, whiteSpace: "nowrap" }}>{ev.minLabel}</span>
      ) : null}
    </div>
  );
}

/** One event in the legend row below the track. Goals/cards/red cards get the
 *  travelling-beam border (`.bf-evt-*`, see globals.css); subs stay static + dim. */
function EventChip({ ev }: { ev: TimelineEvent }) {
  const isSub = ev.kind === "sub";
  return (
    <span className={isSub ? undefined : `bf-evt bf-evt-${ev.kind}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: JB, fontSize: 9.5, color: "#aebdb4", padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.03)", border: isSub ? "1px solid rgba(255,255,255,0.06)" : "none", opacity: isSub ? 0.5 : 1 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: ev.color }} />
      {ev.minLabel}{" "}
      {ev.kind === "sub" ? (
        <span><span style={{ color: "#c8ff2d" }}>▲</span>{ev.player} <span style={{ color: "#6f8a78" }}>▼{ev.playerOut}</span></span>
      ) : (
        <>{ev.player}{ev.kind === "red" ? " 🟥" : ""}</>
      )}
    </span>
  );
}

function TeamBlock({ code, accent, crestSize, enter, craque }: { code: string; accent: string; crestSize: number; enter: "l" | "r"; craque: CraqueBase | null }) {
  return (
    <div className={enter === "l" ? "hero-tin-l" : "hero-tin-r"} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
      <SwitchingCrest code={code} accent={accent} size={crestSize} craque={craque} flip={enter === "r"} />
      <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(15px,1.9vw,24px)", letterSpacing: "-0.02em", color: accent, textAlign: "center", lineHeight: 1, whiteSpace: "nowrap" }}>
        {code}
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
  /** Substitutions (from the lineups) to plot on the timeline. */
  subs?: MatchSub[];
  /** Hide the per-event chip legend below the track (e.g. the tight duo cards). */
  showLegend?: boolean;
}

export function HeroScoreboard({ match, pre = false, compact = false, subs = [], showLegend = true }: HeroScoreboardProps) {
  const homeAccent = teamAccent(match.home.abbreviation);
  const awayAccent = teamAccent(match.away.abbreviation);
  const events = pre ? [] : buildTimeline(match, homeAccent, awayAccent, subs);
  // Show the progress track for any started match — it fills with match time even
  // before the first goal/card (a live 0–0 still shows the clock walking).
  const showTimeline = !pre && match.state !== "pre";
  const crestSize = compact ? 58 : 74;
  const scoreFont = compact ? "clamp(34px,4.5vw,56px)" : "clamp(46px,6.5vw,84px)";
  // If both teams map to the same craque color, one switches to its alternate.
  const craquePair = resolveCraquePair(match.home.abbreviation, match.away.abbreviation);

  return (
    <div style={{ position: "relative", flex: "none", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(200,255,45,0.12)", background: "linear-gradient(180deg, rgba(200,255,45,0.04), transparent)", padding: compact ? "16px 18px 10px" : "22px 22px 12px" }}>
      <style>{"@keyframes heroTeamL{0%{opacity:0;transform:translateX(-46px)}100%{opacity:1;transform:translateX(0)}}@keyframes heroTeamR{0%{opacity:0;transform:translateX(46px)}100%{opacity:1;transform:translateX(0)}}.hero-tin-l{animation:heroTeamL .6s 1.25s ease-out both}.hero-tin-r{animation:heroTeamR .6s 1.25s ease-out both}"}</style>
      <SquadWall base={craquePair.home} side="home" delayBase={0} />
      <SquadWall base={craquePair.away} side="away" delayBase={0.6} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(12px,2.2vw,24px)" }}>
        <TeamBlock code={match.home.abbreviation} accent={homeAccent} crestSize={crestSize} enter="l" craque={craquePair.home} />

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
          {(() => {
            const so = matchShootout(match);
            return so ? (
              <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.06em", color: GOLD_DEEP, whiteSpace: "nowrap" }}>
                PÊNALTIS {so.home}–{so.away}
              </span>
            ) : null;
          })()}
        </div>

        <TeamBlock code={match.away.abbreviation} accent={awayAccent} crestSize={crestSize} enter="r" craque={craquePair.away} />
      </div>

      {showTimeline ? (
        // Full section width so the event chips lay out across the whole row (fewer
        // wrapped lines = shorter hero), instead of a narrow centred column.
        <div style={{ position: "relative", zIndex: 1, margin: "12px 0 0" }}>
          <div style={{ position: "relative", height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, margin: "0 4px" }}>
            <TimelineFill match={match} />
            {events.map((ev, i) => (
              <Marker key={i} ev={ev} withLabel />
            ))}
          </div>
          {showLegend && events.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 10 }}>
              {events.map((ev, i) => (
                <EventChip key={i} ev={ev} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
