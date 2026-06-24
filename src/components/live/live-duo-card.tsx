import type { Match } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import { teamNamePt } from "@/lib/team-names";
import { communityConsensus } from "@/lib/consensus";
import { classifyLivePalpites, type LivePalpite } from "@/lib/live-palpites";
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
  SectionLabel,
  teamAccent,
  type TimelineEvent,
} from "@/components/live/bf-ui";

function Marker({ ev }: { ev: TimelineEvent }) {
  return (
    <div style={{ position: "absolute", top: "50%", left: ev.leftPct, transform: "translate(-50%,-50%)" }}>
      {ev.kind === "goal" ? (
        <span style={{ width: 18, height: 18, borderRadius: "50%", background: ev.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, boxShadow: "0 0 0 3px #061509" }}>⚽</span>
      ) : (
        <span style={{ display: "block", width: 11, height: 15, borderRadius: 2, background: ev.color, boxShadow: "0 0 0 3px #061509" }} />
      )}
    </div>
  );
}

function palpiteRowColor(p: LivePalpite) {
  if (p.bucket === "win") return { name: "#eaffc0", pick: "#c2e69e", status: "#c8ff2d", bg: "rgba(200,255,45,0.08)", border: "1px solid rgba(200,255,45,0.4)", opacity: 1 };
  if (p.bucket === "lost") return { name: "#c7a6a6", pick: "#8a6f6f", status: "#ff8f8f", bg: "rgba(255,90,106,0.05)", border: "1px solid rgba(255,90,106,0.18)", opacity: 0.45 };
  return { name: "#f3e2bf", pick: "#c7b482", status: "#f2c14e", bg: "rgba(242,193,78,0.06)", border: "1px solid rgba(242,193,78,0.3)", opacity: 0.85 };
}

/** One live match in the 2 JOGOS view: score, timeline, consensus + a compact palpite list. */
export function LiveDuoCard({ match, entries, groupLabel }: { match: Match; entries: VoteEntry[]; groupLabel: string }) {
  const homeCode = match.home.abbreviation;
  const awayCode = match.away.abbreviation;
  const homeAccent = teamAccent(homeCode);
  const awayAccent = teamAccent(awayCode);
  const events = buildTimeline(match, homeAccent, awayAccent);
  const consensus = communityConsensus(entries);
  const final = match.state === "post";
  const { winners, open, lost } = classifyLivePalpites(entries, { home: match.homeScore ?? 0, away: match.awayScore ?? 0 }, final);
  const palps = [...winners, ...open, ...lost];

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 11, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, background: "rgba(255,255,255,0.015)", padding: "14px 16px", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: JB, fontSize: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#9ef01f" }}>
          <BfPulse color="#9ef01f" />
          {final ? "ENCERRADO" : "AO VIVO"} · {matchClockLabel(match)}
        </span>
        <span style={{ color: "#6f8a78", letterSpacing: "0.05em" }}>{groupLabel}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, minWidth: 0 }}>
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(12px,1.4vw,17px)", color: homeAccent, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(homeCode, match.home.name).toUpperCase()}</span>
          <FlagCrest code={homeCode} accent={homeAccent} size={46} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 11, flex: "none" }}>
          <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: "clamp(30px,4vw,46px)", lineHeight: 0.74, color: "#fff" }}>{match.homeScore ?? 0}</span>
          <span style={{ width: 15, height: 4, borderRadius: 3, background: LIME, boxShadow: "0 0 11px rgba(200,255,45,0.5)", flex: "0 0 auto" }} />
          <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: "clamp(30px,4vw,46px)", lineHeight: 0.74, color: "#fff" }}>{match.awayScore ?? 0}</span>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <FlagCrest code={awayCode} accent={awayAccent} size={46} />
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(12px,1.4vw,17px)", color: awayAccent, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(awayCode, match.away.name).toUpperCase()}</span>
        </div>
      </div>

      {events.length > 0 ? (
        <>
          <div style={{ position: "relative", height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, margin: "2px 4px" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: elapsedPct(match), background: "linear-gradient(90deg,#3a7d2c,#c8ff2d)", borderRadius: 2 }} />
            {events.map((ev, i) => <Marker key={i} ev={ev} />)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 10px" }}>
            {events.map((ev, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: JB, fontSize: 9, color: "#aebdb4" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: ev.color }} />{ev.minLabel} {ev.player}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {consensus.total > 0 ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: JB, fontSize: 9, color: "#8fa898", marginBottom: 6 }}>
            <span>{homeCode} {consensus.homePct}%</span>
            <span>EMP {consensus.drawPct}%</span>
            <span>{awayCode} {consensus.awayPct}%</span>
          </div>
          <div style={{ display: "flex", height: 6, borderRadius: 4, overflow: "hidden", gap: 2 }}>
            <div style={{ width: `${consensus.homePct}%`, background: homeAccent }} />
            <div style={{ width: `${consensus.drawPct}%`, background: "#3a4a40" }} />
            <div style={{ width: `${consensus.awayPct}%`, background: awayAccent }} />
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0, overflow: "hidden" }}>
        <SectionLabel color="#6f8a78" style={{ letterSpacing: "0.14em", flex: "none" }}>{"// PALPITES"}</SectionLabel>
        <div className="bf-scroll" style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0, paddingRight: 4, overflowY: "auto", overflowX: "hidden" }}>
        {palps.length === 0 ? (
          <span style={{ fontFamily: BRIC, fontSize: 11.5, color: "#6f8a78" }}>Sem palpites nesta partida.</span>
        ) : (
          palps.map((p, i) => {
            const c = palpiteRowColor(p);
            return (
              <div key={i} style={{ opacity: c.opacity, borderRadius: 7, padding: "5px 9px", background: c.bg, border: c.border, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: BRIC, fontWeight: 700, fontSize: 11, color: c.name, flex: "none", maxWidth: 110, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.username}</span>
                <span style={{ fontFamily: JB, fontSize: 9, color: c.pick, flex: 1, minWidth: 0 }}>{homeCode} {p.predHome} × {p.predAway} {awayCode}</span>
                <span style={{ flex: "none", fontFamily: JB, fontSize: 8, letterSpacing: "0.04em", color: c.status }}>{p.status}</span>
              </div>
            );
          })
        )}
        </div>
      </div>

      <span style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", borderRadius: 999, padding: "7px 12px", fontFamily: JB, fontSize: 10, color: "#cbdcd0" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d" }} />AO VIVO NA <span style={{ background: "#53fc18", color: "#000", fontWeight: 800, padding: "1px 5px", borderRadius: 4 }}>K</span>
      </span>
    </div>
  );
}
