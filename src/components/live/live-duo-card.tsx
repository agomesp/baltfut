import type { Match } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import { communityConsensus } from "@/lib/consensus";
import { classifyLivePalpites, type LivePalpite } from "@/lib/live-palpites";
import {
  BRIC,
  JB,
  nameStyle,
  SectionLabel,
  teamAccent,
  VoceTag,
  isMe,
} from "@/components/live/bf-ui";
import { HeroWithCinematic } from "@/components/live/hero-with-cinematic";
import { useMyName } from "@/lib/use-my-name";

function palpiteRowColor(p: LivePalpite) {
  if (p.bucket === "win") return { name: "#eaffc0", pick: "#c2e69e", status: "#c8ff2d", bg: "rgba(200,255,45,0.08)", border: "1px solid rgba(200,255,45,0.4)", opacity: 1 };
  if (p.bucket === "lost") return { name: "#c7a6a6", pick: "#8a6f6f", status: "#ff8f8f", bg: "rgba(255,90,106,0.05)", border: "1px solid rgba(255,90,106,0.18)", opacity: 0.45 };
  return { name: "#f3e2bf", pick: "#c7b482", status: "#f2c14e", bg: "rgba(242,193,78,0.06)", border: "1px solid rgba(242,193,78,0.3)", opacity: 0.85 };
}

/** One live match in the 2 JOGOS view: score, timeline, consensus + a compact palpite list. */
export function LiveDuoCard({ match, entries, groupLabel }: { match: Match; entries: VoteEntry[]; groupLabel: string }) {
  const myName = useMyName();
  const homeCode = match.home.abbreviation;
  const awayCode = match.away.abbreviation;
  const homeAccent = teamAccent(homeCode);
  const awayAccent = teamAccent(awayCode);
  const consensus = communityConsensus(entries);
  const final = match.state === "post";
  // The staggered duo can pair a live game with one that hasn't kicked off yet
  // (the 10-min lead-in), so this card may render a pre-match game.
  const pre = match.state === "pre";
  const { winners, open, lost } = classifyLivePalpites(entries, { home: match.homeScore ?? 0, away: match.awayScore ?? 0 }, final);
  const palps = [...winners, ...open, ...lost];

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 11, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, background: "rgba(255,255,255,0.015)", padding: "14px 16px", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", fontFamily: JB, fontSize: 10 }}>
        <span style={{ color: "#6f8a78", letterSpacing: "0.05em" }}>{groupLabel}</span>
      </div>

      {/* Same score panel + effects as the 1-game hero (SwitchingCrest, SquadWall,
          goal/foul cinematic), compact + without the event legend to fit the card. */}
      <HeroWithCinematic match={match} pre={pre} compact showLegend={false} />

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
                <span style={{ fontFamily: BRIC, fontWeight: 700, fontSize: 11, ...nameStyle(p.username, c.name), flex: "none", maxWidth: 110, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.username}</span>
                {isMe(p.username, myName) ? <VoceTag /> : null}
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
