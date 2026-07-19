"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Match } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import type { BracketEntry } from "@/lib/bracket-votes";
import type { MatchResult } from "@/lib/ranking";
import { supabaseCastVote, type CastVoteTransport } from "@/lib/votes";
import { teamNamePt } from "@/lib/team-names";
import { fmtTime } from "@/lib/format";
import { teamCupHistory, type TeamHistoryGame } from "@/lib/team-history";
import { communityConsensus, type Consensus } from "@/lib/consensus";
import { palpiteDeadline, effectiveDeadline, isPalpiteOpen, formatCountdown, formatCountdownLong, visiblePalpites } from "@/lib/palpite";
import { detectChegandoChanges, buildChegandoRows } from "@/lib/chegando";
import { useIsNarrow } from "@/lib/use-is-narrow";
import { useNow } from "@/lib/use-now";
import { isReservedName } from "@shared/name-claim";
import { Countdown } from "@/components/countdown";
import { motion } from "framer-motion";
import { RollingNumber, IdleFloat, Parallax, PopIn, usePointer3D } from "@/components/live/fx";
import { userAccuracy } from "@/lib/champions/rankings";
import { buildResultMap } from "@/lib/use-sub-ranks";
import { RankingSubs } from "@/components/live/ranking-subs";
import { IaVsVoce } from "@/components/live/ia-vs-voce";
import { PromoSpotlight } from "@/components/live/promo-spotlight";
import { subscribePromoDisplay, isPromoDisplay } from "@/lib/promo-display";
import { CommunityBar } from "@/components/live/community-bar";
import {
  PalpiteForm,
  Stepper,
  NameField,
  useNameLock,
  castPalpite,
} from "@/components/live/palpite-form";
import {
  BRIC,
  BfPulse,
  DIM,
  DIM_2,
  FlagCrest,
  FlagIcon,
  GOLD,
  GOLD_DEEP,
  JB,
  LIME,
  nameStyle,
  SAIRA,
  SectionLabel,
  teamAccent,
} from "@/components/live/bf-ui";

function groupVenue(match: Match, groupByTeam: Record<string, string>): string {
  const g = groupByTeam[match.home.abbreviation] ?? groupByTeam[match.away.abbreviation];
  return [g ? `GRUPO ${g}` : "", match.venue ?? ""].filter(Boolean).join(" · ").toUpperCase();
}

function pickLine(e: VoteEntry, homeCode: string, awayCode: string): string {
  return `${homeCode} ${e.predHome} × ${e.predAway} ${awayCode}`;
}

/** Big MM:SS / H:MM:SS countdown to kickoff with a lime colon accent. */
const CLOCK_STYLE = { fontFamily: SAIRA, fontWeight: 800, fontSize: 36, color: "#fff", lineHeight: 0.78, letterSpacing: "0.02em" } as const;

function KickoffClock({ startsAt }: { startsAt: string }) {
  return (
    <Countdown
      targetMs={Date.parse(startsAt)}
      render={(ms) => {
        if (ms <= 0) return <span style={CLOCK_STYLE}>00:00</span>;
        const parts = formatCountdownLong(ms).split(":");
        // Inside the last minute the clock breathes and the separator strobes —
        // the point where a room watching a stream starts counting out loud.
        const urgent = ms < 60_000;
        return (
          <motion.span
            style={{ ...CLOCK_STYLE, display: "inline-block", transformOrigin: "center" }}
            animate={urgent ? { scale: [1, 1.07, 1], color: ["#fff", "#ffd76a", "#fff"] } : { scale: 1, color: "#fff" }}
            transition={urgent ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.25 }}
          >
            {parts.map((p, i) => (
              <span key={i}>
                {i > 0 ? (
                  <motion.span
                    style={{ color: LIME, display: "inline-block" }}
                    animate={urgent ? { opacity: [1, 0.25, 1] } : { opacity: 1 }}
                    transition={urgent ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.25 }}
                  >
                    :
                  </motion.span>
                ) : null}
                {/* Only the digits that actually tick over move. */}
                <RollingNumber value={p} />
              </span>
            ))}
          </motion.span>
        );
      }}
    />
  );
}

function SentList({ entries, homeCode, awayCode, myName, cols = 2, pendingName = null }: { entries: VoteEntry[]; homeCode: string; awayCode: string; myName: string | null; cols?: number; pendingName?: string | null }) {
  const myLower = myName ? myName.trim().toLowerCase() : "";
  const myEntry = myLower ? entries.find((e) => e.username.trim().toLowerCase() === myLower) : undefined;
  // Pin the house bot (ChatGPT) first, then VOCÊ, then everyone else — stable
  // within each group. Makes the feed read at a glance for stream viewers.
  const rankOf = (e: VoteEntry) => (isReservedName(e.username) ? 0 : myLower && e.username.trim().toLowerCase() === myLower ? 1 : 2);
  const sorted = [...entries].sort((a, b) => rankOf(a) - rankOf(b));
  const samePick = (e: VoteEntry) =>
    myEntry != null && e.username.trim().toLowerCase() !== myLower && e.predHome === myEntry.predHome && e.predAway === myEntry.predAway;
  const sameCount = myEntry ? entries.filter(samePick).length : 0;

  return (
    <>
      {myEntry && sameCount > 0 ? (
        <div style={{ flex: "none", fontFamily: JB, fontSize: 9, letterSpacing: "0.04em", color: "#9bb6a6", marginBottom: 6 }}>
          {sameCount} {sameCount === 1 ? "pessoa tem" : "pessoas têm"} o mesmo placar que você
        </div>
      ) : null}
      <div className="bf-scroll" style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "7px 8px", alignContent: "start", flex: 1, minHeight: 0, paddingRight: 4, overflowY: "auto", overflowX: "hidden" }}>
        {sorted.length === 0 ? (
          <div style={{ fontFamily: BRIC, fontSize: 11.5, color: "#6f8a78" }}>Nenhum palpite ainda. Seja o primeiro.</div>
        ) : (
          sorted.map((e, i) => {
            const mine = myName != null && e.username.trim().toLowerCase() === myLower;
            const saving = pendingName != null && e.username.trim().toLowerCase() === pendingName;
            const same = samePick(e);
            const bg = saving ? "rgba(255,255,255,0.04)" : mine ? "rgba(200,255,45,0.1)" : same ? "rgba(200,255,45,0.045)" : "rgba(255,255,255,0.025)";
            const border = saving ? "1px solid rgba(255,255,255,0.08)" : mine ? "1px solid rgba(200,255,45,0.4)" : same ? "1px solid rgba(200,255,45,0.22)" : "1px solid rgba(255,255,255,0.05)";
            return (
              <div key={`${e.username}-${i}`} className={saving ? "bf-saving" : undefined} style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 7, padding: "6px 8px", backgroundColor: bg, border, opacity: saving ? 0.55 : 1 }}>
                <span style={{ fontFamily: BRIC, fontWeight: 700, fontSize: 11.5, ...nameStyle(e.username, "#eef3ee"), flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.username}</span>
                {mine && !saving ? <span style={{ flex: "none", fontFamily: JB, fontSize: 7.5, letterSpacing: "0.06em", fontWeight: 700, color: "#0f1f02", background: LIME, padding: "2px 5px", borderRadius: 4 }}>VOCÊ</span> : null}
                {same ? <span title="mesmo placar que você" style={{ flex: "none", fontFamily: JB, fontSize: 9, color: LIME }}>=</span> : null}
                <span style={{ flex: "none", fontFamily: JB, fontSize: 9.5, color: same ? "#cdeec0" : "#aebdb4" }}>{pickLine(e, homeCode, awayCode)}</span>
                {e.penWinner ? <span title="pênaltis: quem vence" style={{ flex: "none", fontFamily: JB, fontSize: 8, letterSpacing: "0.02em", color: GOLD_DEEP }}>pên {e.penWinner === "home" ? homeCode : awayCode}</span> : null}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function HistoryColumn({ code, accent, games }: { code: string; accent: string; games: TeamHistoryGame[] }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.1em", color: accent, marginBottom: 8 }}>{code} · NA COPA</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {games.length === 0 ? (
          <div style={{ fontFamily: BRIC, fontSize: 11, color: "#6f8a78" }}>Sem jogos ainda.</div>
        ) : (
          games.map((g, i) => {
            const badgeColor = g.res === "V" ? "#0f1f02" : g.res === "D" ? "#ff8f8f" : "#cfd3ce";
            const badgeBg = g.res === "V" ? "#c8ff2d" : g.res === "D" ? "rgba(255,90,106,0.14)" : "rgba(255,255,255,0.08)";
            const rowBg = g.res === "V" ? "rgba(200,255,45,0.08)" : g.res === "D" ? "rgba(255,90,106,0.08)" : "rgba(255,255,255,0.035)";
            const rowBorder = g.res === "V" ? "1px solid rgba(200,255,45,0.32)" : g.res === "D" ? "1px solid rgba(255,90,106,0.28)" : "1px solid rgba(255,255,255,0.07)";
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 7, padding: "5px 9px", background: rowBg, border: rowBorder }}>
                <span style={{ flex: "none", width: 18, height: 18, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: JB, fontSize: 9, fontWeight: 700, color: badgeColor, background: badgeBg }}>{g.res}</span>
                <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontSize: 11.5, color: "#cfd9d1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>vs {teamNamePt(g.oppCode, g.opp)}</span>
                <span style={{ flex: "none", fontFamily: SAIRA, fontWeight: 700, fontSize: 13, color: "#fff" }}>{g.score}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function PreHero({ match, groupByTeam, consensus }: { match: Match; groupByTeam: Record<string, string>; consensus: Consensus }) {
  const homeAccent = teamAccent(match.home.abbreviation);
  const awayAccent = teamAccent(match.away.abbreviation);
  const p3 = usePointer3D();
  return (
    <div style={{ position: "relative", height: "100%", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,179,71,0.16)", background: "linear-gradient(180deg, rgba(255,179,71,0.06), transparent)", padding: "14px 22px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <Parallax p3={p3} depth={0.55} tilt={3.5} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(12px,3vw,30px)" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(18px,2.2vw,26px)", letterSpacing: "-0.02em", color: homeAccent, whiteSpace: "nowrap" }}>{match.home.abbreviation}</span>
          {/* The two crests bob out of phase, so the hero never sits perfectly still. */}
          <IdleFloat amount={4} seconds={5.2}><FlagCrest code={match.home.abbreviation} accent={homeAccent} size={50} /></IdleFloat>
        </div>
        {/* Countdown sits nearest the viewer, so it swings hardest. */}
        <Parallax p3={p3} depth={1.5} style={{ flex: "none", textAlign: "center" }}>
          <div style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.2em", color: GOLD, marginBottom: 6 }}>COMEÇA EM</div>
          <KickoffClock startsAt={match.startsAt} />
          {/* Exact kickoff time leads the meta line beneath the countdown. */}
          <div style={{ fontFamily: JB, fontSize: 9, color: "#6f8a78", marginTop: 9, letterSpacing: "0.05em" }}>
            <span style={{ color: "#8fae99" }}>{fmtTime(match.startsAt)}</span> · {groupVenue(match, groupByTeam) || "COPA DO MUNDO"}
          </div>
        </Parallax>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(18px,2.2vw,26px)", letterSpacing: "-0.02em", color: awayAccent, whiteSpace: "nowrap" }}>{match.away.abbreviation}</span>
          <IdleFloat amount={4} seconds={5.2} delay={1.3}><FlagCrest code={match.away.abbreviation} accent={awayAccent} size={50} /></IdleFloat>
        </div>
      </Parallax>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 14 }}>
        {/* The palpite deadline is folded into the open-palpites pill itself. */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: JB, fontSize: 10, color: "#cdeec0", background: "rgba(200,255,45,0.1)", border: "1px solid rgba(200,255,45,0.3)", borderRadius: 999, padding: "6px 15px", whiteSpace: "nowrap" }}>
            <BfPulse />
            <span>
              PALPITES ABERTOS · Fecha em{" "}
              <Countdown targetMs={palpiteDeadline(match.startsAt)} render={(ms) => <>{formatCountdown(Math.max(0, ms))}</>} />
            </span>
          </span>
        </div>
        <CommunityBar consensus={consensus} homeCode={match.home.abbreviation} awayCode={match.away.abbreviation} homeAccent={homeAccent} awayAccent={awayAccent} bare label="OS SUBS PALPITAM" />
      </div>
    </div>
  );
}

const cardWrap = { borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" } as const;

// ── Test1 design (palpite pelo chat da Kick) ──────────────────────────────────
// LOCAL design exploration: a big "DIGITE 2×1 NO CHAT" call-to-action (left) and
// a live "CHEGANDO DO CHAT" feed (middle) that animates real palpites in.

/** The headline CTA — how to palpitar via the Kick chat. `pen` swaps it to the
 *  gold pen-winner-by-chat variant (Test2). Static design + real team codes; the
 *  feed renders separately (ChegandoFeed). */
function ChatCta({ homeCode, awayCode, pen = false }: { homeCode: string; awayCode: string; pen?: boolean }) {
  const accent = pen ? GOLD_DEEP : LIME;
  const cardBorder = pen ? "1px solid rgba(232,181,58,0.5)" : "1px solid rgba(200,255,45,0.3)";
  const cardBg = pen
    ? "linear-gradient(160deg, rgba(232,181,58,0.1), rgba(232,181,58,0.03) 60%, transparent)"
    : "linear-gradient(160deg, rgba(200,255,45,0.07), rgba(83,252,24,0.03) 60%, transparent)";
  const inputBg = pen ? "#130d06" : "#0c130d";
  const inputDim = pen ? "#a3927a" : "#8aa394";
  return (
    <div style={{ ...cardWrap, flex: 1, minWidth: 0, minHeight: 0, overflow: "auto", padding: "clamp(16px,2vw,28px)", border: cardBorder, background: cardBg, display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{"@keyframes bfblink{0%,49%{opacity:1}50%,100%{opacity:0}}"}</style>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 9, alignSelf: "flex-start", fontFamily: JB, fontSize: 12, letterSpacing: "0.08em", color: pen ? "#1a1206" : "#0a0a0a", background: pen ? GOLD_DEEP : "#53fc18", borderRadius: 999, padding: "5px 13px", fontWeight: 800 }}>
        {pen ? "🥅 PÊNALTIS PELO CHAT DA KICK" : "▶ PALPITE PELO CHAT DA KICK"}
      </span>
      {pen ? (
        <h1 style={{ margin: 0, fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(28px,4vw,52px)", lineHeight: 0.98, letterSpacing: "-0.02em", color: "#fff" }}>QUEM VENCE<br />NOS <span style={{ color: accent }}>PÊNALTIS?</span></h1>
      ) : (
        <h1 style={{ margin: 0, fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(28px,4vw,54px)", lineHeight: 0.98, letterSpacing: "-0.02em", color: "#fff" }}>DIGITE <span style={{ color: accent }}>2×1</span><br />NO CHAT</h1>
      )}
      {pen ? (
        <div style={{ fontFamily: BRIC, fontSize: "clamp(13px,1.4vw,18px)", color: "#e3d8c2", lineHeight: 1.45 }}>Digite o time no chat — <b style={{ color: "#fff" }}>{homeCode}</b> ou <b style={{ color: "#fff" }}>{awayCode}</b> (sigla ou nome). Acertar o vencedor vale <b style={{ color: accent }}>+0,5</b> no ranking.</div>
      ) : (
        <div style={{ fontFamily: BRIC, fontSize: "clamp(13px,1.4vw,18px)", color: "#cdd8cf", lineHeight: 1.45 }}>Mande o placar no chat — <b style={{ color: "#fff" }}>1º número é o mandante</b> ({homeCode}). Seu <b style={{ color: accent }}>@nick</b> entra no Ranking dos Subs na hora.</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 12, background: inputBg, border: "1px solid rgba(255,255,255,0.12)" }}>
        <span style={{ flex: "none", width: 28, height: 28, borderRadius: 7, background: "#53fc18", color: "#0a0a0a", fontFamily: BRIC, fontWeight: 900, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>K</span>
        <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontSize: 17, color: inputDim }}>Mensagem… <span style={{ color: "#fff", fontWeight: 800 }}>{pen ? homeCode : `${homeCode} 2x1 ${awayCode}`}</span><span style={{ display: "inline-block", width: 2, height: 19, background: accent, marginLeft: 3, verticalAlign: "-4px", animation: "bfblink 1s step-end infinite" }} /></span>
        <span style={{ flex: "none", fontFamily: JB, fontSize: 11, color: DIM }}>ENVIAR ↵</span>
      </div>
      <span style={{ fontFamily: JB, fontSize: 11.5, color: GOLD_DEEP }}>
        {pen ? "✦ fecha quando a 1ª penalidade for batida · escolha agora" : "✦ mandou de novo? troca o placar · vale até o apito + 5min"}
      </span>
    </div>
  );
}

function ChegandoRow({ nick, value, fresh, changed, pen }: { nick: string; value: string; fresh: boolean; changed: boolean; pen: boolean }) {
  const freshBg = pen ? "rgba(232,181,58,0.12)" : "rgba(200,255,45,0.1)";
  const freshBorder = pen ? "1px solid rgba(232,181,58,0.4)" : "1px solid rgba(200,255,45,0.34)";
  // A CHANGED palpite (re-palpite) wins the styling: yellow card + "alterado" so a
  // viewer can tell at a glance someone swapped their pick.
  const changedBg = "rgba(255,205,50,0.15)";
  const changedBorder = "1px solid rgba(255,205,50,0.6)";
  const bg = changed ? changedBg : fresh ? freshBg : "rgba(255,255,255,0.03)";
  const border = changed ? changedBorder : fresh ? freshBorder : "1px solid rgba(255,255,255,0.05)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 15px", borderRadius: 12, background: bg, border, animation: "chegaIn .42s cubic-bezier(.2,.8,.2,1)" }}>
      <span style={{ flex: "none", width: 30, height: 30, borderRadius: 8, background: "#53fc18", color: "#0a0a0a", fontFamily: BRIC, fontWeight: 900, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>K</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontWeight: 700, fontSize: 19, color: "#eef3ee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nick}</span>
      {pen ? (
        <span style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 7, fontFamily: BRIC, fontWeight: 800, fontSize: 19, color: changed ? "#ffd24a" : "#f3d27a" }}><FlagIcon code={value} size={16} /> {value}</span>
      ) : (
        <span style={{ flex: "none", fontFamily: SAIRA, fontWeight: 800, fontSize: 26, color: changed ? "#ffd24a" : "#fff" }}>{value}</span>
      )}
      <span style={{ flex: "none", fontFamily: JB, fontSize: 11, color: changed ? "#ffd24a" : pen ? GOLD_DEEP : LIME, fontWeight: 700 }}>{changed ? "alterado ⟳" : "registrado ✓"}</span>
    </div>
  );
}

/** The live "CHEGANDO DO CHAT" timeline of REAL palpites: chat-bot picks
 *  (baltfut-admin writes them to `votes`) and website-cast palpites both land in
 *  `vote_entries` → here. Newest-first; existing palpites show on load and each
 *  newly-arriving one animates in (the per-row chegaIn runs when its node mounts,
 *  keyed by username so only genuinely-new palpites animate). */
function ChegandoFeed({ entries, pen = false, homeCode = "", awayCode = "" }: { entries: VoteEntry[]; pen?: boolean; homeCode?: string; awayCode?: string }) {
  // Detect a CHANGED palpite (a re-palpite) live: the votes feed keeps one row per
  // user, so when that row's value differs from what we last saw, the person swapped
  // their pick. Mark it (with the moment we noticed) so it bubbles to the top in
  // yellow as "alterado" — and since it's the SAME keyed row, its old position is
  // vacated (no duplicate to remove). First sight of a name is NOT a change.
  const seenRef = useRef(new Map<string, string>());
  const [changedAt, setChangedAt] = useState<Map<string, number>>(() => new Map());
  useEffect(() => {
    const changed = detectChegandoChanges(entries, seenRef.current, pen, homeCode, awayCode);
    if (changed.length) {
      const now = Date.now();
      setChangedAt((cur) => {
        const next = new Map(cur);
        for (const u of changed) next.set(u, now);
        return next;
      });
    }
  }, [entries, pen, homeCode, awayCode]);

  const rows = useMemo(
    () => buildChegandoRows(entries, changedAt, pen, homeCode, awayCode, 24),
    [entries, pen, homeCode, awayCode, changedAt],
  );

  return (
    <div style={{ ...cardWrap, flex: 1, minWidth: 0, minHeight: 0, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <style>{"@keyframes chegaIn{from{opacity:0;transform:translateY(-10px) scale(.98)}to{opacity:1;transform:none}}"}</style>
      <span style={{ flex: "none", fontFamily: JB, fontSize: 11, letterSpacing: "0.12em", color: DIM_2 }}>{pen ? "CHEGANDO DO CHAT" : "PALPITES CHEGANDO"}</span>
      <div className="bf-scroll" style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", paddingRight: 4 }}>
        {rows.length === 0 ? (
          <div style={{ fontFamily: BRIC, fontSize: 12, color: "#6f8a78" }}>Nenhum palpite ainda — manda no chat!</div>
        ) : (
          rows.map((r, i) => (
            <PopIn key={r.key} index={i}>
              <ChegandoRow nick={r.nick} value={r.value} fresh={i === 0 && !r.changed} changed={r.changed} pen={pen} />
            </PopIn>
          ))
        )}
      </div>
    </div>
  );
}

/** Pen-winner form: the gold variant of the score form — pick the shootout winner
 *  by tapping a flag (replaces the score steppers). LOCAL design (prepen mock). */
function PenForm({ match }: { match: Match }) {
  const { name, setName, locked, unlock } = useNameLock();
  const [pick, setPick] = useState<"home" | "away" | null>(null);
  const homeCode = match.home.abbreviation;
  const awayCode = match.away.abbreviation;
  const homeAccent = teamAccent(homeCode);
  const awayAccent = teamAccent(awayCode);
  // Tapping a flag IS the submit (auto-saves the pen-winner pick); tapping the
  // other flag switches it. No separate send button.
  const flagBtn = (side: "home" | "away", code: string, accent: string) => {
    const sel = pick === side;
    return (
      <button type="button" onClick={() => setPick(side)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "13px 10px", borderRadius: 12, cursor: "pointer", background: sel ? "rgba(232,181,58,0.16)" : "rgba(232,181,58,0.05)", border: `1px solid ${sel ? GOLD_DEEP : "rgba(232,181,58,0.4)"}`, boxShadow: sel ? "0 0 22px -8px rgba(232,181,58,0.6)" : "none" }}>
        <FlagCrest code={code} accent={accent} size={42} />
        <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 17, color: sel ? "#fff" : accent }}>{code}</span>
        <span style={{ fontFamily: JB, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", color: sel ? GOLD_DEEP : DIM_2 }}>{sel ? "ENVIADO ✓" : "tocar"}</span>
      </button>
    );
  };
  return (
    <div style={{ ...cardWrap, flex: 1, minWidth: 0, border: "1px solid rgba(232,181,58,0.45)", padding: "13px 16px", display: "flex", flexDirection: "column", gap: 11 }}>
      <NameField name={name} setName={setName} locked={locked} onUnlock={unlock} />
      <span style={{ fontFamily: JB, fontSize: 9.5, letterSpacing: "0.06em", color: "#caa94a", textAlign: "center" }}>QUEM VENCE NOS PÊNALTIS? <span style={{ color: DIM_2 }}>(vale +0,5)</span></span>
      <div style={{ display: "flex", gap: 12 }}>
        {flagBtn("home", homeCode, homeAccent)}
        {flagBtn("away", awayCode, awayAccent)}
      </div>
      <div style={{ fontFamily: JB, fontSize: 9, color: "#6f8a78", textAlign: "center", letterSpacing: "0.04em" }}>
        {pick ? "salvo na hora · toque na outra bandeira pra trocar" : "toque na bandeira do vencedor · salva na hora · vale +0,5"}
      </div>
    </div>
  );
}

export interface PreMatchPanelProps {
  match: Match;
  /** Pen-winner mode (gold): pick the shootout winner instead of the score. */
  pen?: boolean;
  /** Simultaneous partner to co-show (the AUTO duo); null = single game. */
  second: Match | null;
  entries: VoteEntry[];
  secondEntries: VoteEntry[];
  allEntries: VoteEntry[];
  matches: Match[];
  /** Durable finished-match scores (match_results) — preferred over ESPN for
   *  grading the ranking, so a dropped/changed ESPN result can't erase wins. */
  results?: Record<string, MatchResult>;
  /** Saved knockout brackets — 0.2 per correct winner folds into the ranking. */
  brackets?: BracketEntry[];
  groupByTeam: Record<string, string>;
  /** Matches open for palpites (current + next kickoff group). */
  releasedIds: Set<string>;
  /** Manual per-match palpite windows from the admin: match_id → openUntil (ms). */
  palpiteOverrides?: Record<string, number>;
  onVoted: () => void;
  transport?: CastVoteTransport;
}

export function PreMatchPanel({ match, pen = false, second, entries, secondEntries, allEntries, matches, results, brackets, groupByTeam, releasedIds, palpiteOverrides = {}, onVoted, transport = supabaseCastVote }: PreMatchPanelProps) {
  // A manual admin window for a match: its openUntil (ms) overrides the default
  // cutoff, and its mere presence releases the match's form (even if it would
  // otherwise be locked / past the grace).
  const ovr = (m: Match) => palpiteOverrides[m.id] ?? null;
  const releasedOr = (m: Match) => releasedIds.has(m.id) || ovr(m) != null;
  const { name } = useNameLock();
  const myName = name || null;
  // The viewer's running hit rate, graded off the same map the ranking uses.
  // Null without a claimed nickname, so the badge simply doesn't appear.
  const myAccuracy = useMemo(
    () => userAccuracy(allEntries, buildResultMap(matches, results), myName),
    [allEntries, matches, results, myName],
  );
  const narrow = useIsNarrow();
  const homeCode = match.home.abbreviation;
  const awayCode = match.away.abbreviation;
  const homeAccent = teamAccent(homeCode);
  const awayAccent = teamAccent(awayCode);
  // The parent (decideConcurrent) only hands us a `second` when it wants the duo,
  // so simply mirror that — AUTO with a simultaneous partner shows both games.
  const showDuo = second != null;
  // Hide the house bot (ChatGPT) from this match's feed + consensus until palpites
  // close, so its pick can't be copied; revealed the moment the window shuts.
  const now = useNow(1000);
  const open = isPalpiteOpen(effectiveDeadline(match.startsAt, ovr(match)), now);
  const visibleEntries = useMemo(() => visiblePalpites(entries, open), [entries, open]);
  // Crowd's home/draw/away split for this match — recomputes as palpites stream in
  // (poll/realtime).
  const consensus = useMemo(() => communityConsensus(visibleEntries), [visibleEntries]);

  // Streamer promo mode: swap the center/right cards for a big promo (see the promo
  // branch below). alreadySent mirrors PalpiteForm's rule — this locked name already
  // has a palpite here — so we can free its left slot for the moved "Começa em" card.
  const promoOn = useSyncExternalStore(subscribePromoDisplay, isPromoDisplay, () => false);
  const lowerMyName = myName?.trim().toLowerCase();
  const alreadySent = !!lowerMyName && entries.some((e) => e.username.trim().toLowerCase() === lowerMyName);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 11, flex: 1, minHeight: 0 }}>
      {!showDuo ? (
        (() => {
          const preHero = <PreHero match={match} groupByTeam={groupByTeam} consensus={consensus} />;
          const ranking = <RankingSubs entries={allEntries} matches={matches} results={results} brackets={brackets} locked variant="column" style={{ flex: "none", width: "100%" }} />;
          const formCard = pen ? (
            <PenForm match={match} />
          ) : (
            <div style={{ ...cardWrap, flex: "none", minWidth: 0, border: "1px solid rgba(200,255,45,0.16)", padding: "13px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <PalpiteForm match={match} entries={entries} closesAt={effectiveDeadline(match.startsAt, ovr(match))} released={releasedOr(match)} hideCountdown accuracy={myAccuracy} onVoted={onVoted} transport={transport} />
            </div>
          );
          // The two teams' last cup games — moved out of the form card to sit in its
          // own panel to the RIGHT of the hero.
          const historyEl = (
            <div style={{ ...cardWrap, flex: narrow ? "none" : 1, minWidth: 0, minHeight: 0, padding: "13px 16px", display: "flex", flexDirection: "column" }}>
              <div className="bf-scroll" style={{ display: "flex", gap: 12, flex: 1, minHeight: 0, alignItems: "flex-start", paddingRight: 4, overflowY: "auto", overflowX: "hidden" }}>
                <HistoryColumn code={homeCode} accent={homeAccent} games={teamCupHistory(matches, homeCode)} />
                <HistoryColumn code={awayCode} accent={awayAccent} games={teamCupHistory(matches, awayCode)} />
              </div>
            </div>
          );
          const iaEl = <IaVsVoce entries={allEntries} matches={matches} name={myName} style={{ flex: "none" }} />;
          // "A comunidade palpita" now lives INSIDE the hero (below the open-palpites
          // pill), so it's not rendered again in the side column.

          // Mobile: everything stacks in reading order (hero → form → NA COPA →
          // chat CTA → chegando feed → IA → comunidade → ranking).
          if (narrow) {
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 11, flex: 1, minHeight: 0 }}>
                {preHero}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {formCard}
                  {historyEl}
                  <ChatCta homeCode={homeCode} awayCode={awayCode} pen={pen} />
                  <ChegandoFeed entries={visibleEntries} pen={pen} homeCode={homeCode} awayCode={awayCode} />
                  {iaEl}
                  {ranking}
                </div>
              </div>
            );
          }

          // Desktop TOP ROW — form | hero | NA COPA, all the same height. The form
          // takes its natural height (so its ENVIAR PALPITE button is fully visible)
          // and sets the row height; the hero card stretches to fill it (content
          // vertically centered) and the NA COPA card fills it with an inner scroll.
          const cappedForm = pen ? (
            <PenForm match={match} />
          ) : (
            <div style={{ ...cardWrap, flex: 1, minWidth: 0, border: "1px solid rgba(200,255,45,0.16)", padding: "13px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <PalpiteForm match={match} entries={entries} closesAt={effectiveDeadline(match.startsAt, ovr(match))} released={releasedOr(match)} hideCountdown accuracy={myAccuracy} onVoted={onVoted} transport={transport} />
            </div>
          );
          // NA COPA (the teams' last games) — short, content-height card at the top
          // of the right column (IA + ranking stack right under it).
          const naCard = (
            <div style={{ ...cardWrap, flex: "none", minWidth: 0, padding: "13px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <HistoryColumn code={homeCode} accent={homeAccent} games={teamCupHistory(matches, homeCode)} />
              <HistoryColumn code={awayCode} accent={awayAccent} games={teamCupHistory(matches, awayCode)} />
            </div>
          );
          // CSS grid so BOTH rows share the exact same columns: the chat CTA lines
          // up to the form's width, and the "chegando" feed to the hero's width
          // (minmax(0,…) lets a column shrink below its content so the form's
          // steppers don't widen its column out of sync with the row below).
          return promoOn ? (
            // Streamer promo mode: "Começa em" moves to the left slot (or the form
            // stays there if you haven't palpitado yet); Na copa + IA vs Você are
            // hidden so a big promo card fills the center+right; the chat CTA,
            // "chegando" feed and ranking keep the bottom row.
            // BOUNDED rows (not auto): PromoSpotlight measures its own height
            // (ResizeObserver) and expands as a flex child, so an `auto` row would feed
            // back into itself — stalling its entrance animation and thrashing. Fixed-
            // fraction rows give it a determined height and always leave room for row 2
            // (chat CTA | chegando | ranking). Row 1 min 320px fits the form.
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr) minmax(0,1fr)", gridTemplateRows: "minmax(320px, 1.1fr) minmax(0, 1fr)", gap: 12, flex: 1, minHeight: 0 }}>
              <div style={{ gridColumn: 1, gridRow: 1, minWidth: 0, minHeight: 0, display: "flex", overflowY: "auto" }}>{alreadySent ? preHero : cappedForm}</div>
              <div style={{ gridColumn: "2 / 4", gridRow: 1, minWidth: 0, minHeight: 0, display: "flex" }}>
                <PromoSpotlight />
              </div>
              <div style={{ gridColumn: 1, gridRow: 2, minWidth: 0, minHeight: 0 }}>
                <ChatCta homeCode={homeCode} awayCode={awayCode} pen={pen} />
              </div>
              <div style={{ gridColumn: 2, gridRow: 2, minWidth: 0, minHeight: 0, display: "flex" }}>
                <ChegandoFeed entries={visibleEntries} pen={pen} homeCode={homeCode} awayCode={awayCode} />
              </div>
              <div className="bf-scroll" style={{ gridColumn: 3, gridRow: 2, minWidth: 0, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                {ranking}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr) minmax(0,1fr)", gridTemplateRows: "auto minmax(0,1fr)", gap: 12, flex: 1, minHeight: 0 }}>
              {/* Row 1, cols 1-2: form | hero */}
              {cappedForm}
              {preHero}
              {/* RIGHT column spans both rows so IA sits right under NA COPA (no gap)
                  and the ranking takes the remaining height. */}
              <div style={{ gridColumn: 3, gridRow: "1 / 3", display: "flex", flexDirection: "column", gap: 12, minWidth: 0, minHeight: 0 }}>
                {naCard}
                {iaEl}
                <div className="bf-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                  {ranking}
                </div>
              </div>
              {/* Row 2, cols 1-2: chat-palpite CTA | live "chegando" feed */}
              <ChatCta homeCode={homeCode} awayCode={awayCode} pen={pen} />
              <ChegandoFeed entries={visibleEntries} pen={pen} homeCode={homeCode} awayCode={awayCode} />
            </div>
          );
        })()
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
            <SectionLabel color={GOLD}>{"// PALPITES ABERTOS"}</SectionLabel>
          </div>
          <PreMatchDuo
            match={match}
            second={second!}
            entries={entries}
            secondEntries={secondEntries}
            allEntries={allEntries}
            matches={matches}
            results={results}
            brackets={brackets}
            groupByTeam={groupByTeam}
            released1={releasedOr(match)}
            released2={releasedOr(second!)}
            openUntil1={ovr(match)}
            openUntil2={ovr(second!)}
            onVoted={onVoted}
            transport={transport}
          />
        </>
      )}
    </section>
  );
}

export function DuoGameCard({ match, entries, groupByTeam, name, confirm, released, openUntil = null, borderColor, transport, onVoted }: {
  match: Match;
  entries: VoteEntry[];
  groupByTeam: Record<string, string>;
  /** Shared (locked/typed) name from the panel header. */
  name: string;
  confirm: (n: string) => void;
  released: boolean;
  /** Manual admin window (ms): overrides the default kickoff+grace cutoff. */
  openUntil?: number | null;
  borderColor: string;
  transport: CastVoteTransport;
  onVoted: () => void;
}) {
  const homeCode = match.home.abbreviation;
  const awayCode = match.away.abbreviation;
  const homeAccent = teamAccent(homeCode);
  const awayAccent = teamAccent(awayCode);
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  // `saving` = the write is in-flight; `sent` = the optimistic palpite, shown the
  // instant you click and reverted if the server rejects it.
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState<VoteEntry | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const myName = name.trim() || null;
  // Ticks so the form locks itself the moment the kickoff+grace deadline passes,
  // even while this card lingers in the post-deadline tail (palpiteFormVisible).
  const now = useNow(1000);
  const open = isPalpiteOpen(effectiveDeadline(match.startsAt, openUntil), now);

  useEffect(() => {
    if (!outcome) return;
    const id = window.setTimeout(() => setOutcome(null), 5000);
    return () => window.clearTimeout(id);
  }, [outcome]);

  const lowerName = name.trim().toLowerCase();
  // Memoized so the per-second clock tick (the deadline check) doesn't re-scan the
  // entries / rebuild the list / recompute the split. Recomputes when the palpites
  // change (poll/realtime), the viewer's name changes, or they just submitted.
  const meInEntries = useMemo(
    () => lowerName !== "" && entries.some((x) => x.username.trim().toLowerCase() === lowerName),
    [entries, lowerName],
  );
  const alreadySent = meInEntries || sent != null;
  const shownEntries = useMemo(
    () => (sent && !meInEntries ? [sent, ...entries] : entries),
    [sent, meInEntries, entries],
  );
  // Hide the house bot's (ChatGPT's) pick until this match's palpite window closes,
  // so viewers can't copy the AI before locking in their own; revealed once closed.
  const visibleEntries = useMemo(() => visiblePalpites(shownEntries, open), [shownEntries, open]);
  // Live home/draw/away split for this game — recomputes whenever palpites change
  // (the entries prop refreshes via polling/realtime), like the single-match view.
  const consensus = useMemo(() => communityConsensus(visibleEntries), [visibleEntries]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setOutcome("Digite seu nome.");
      return;
    }
    // Closed window (sent in the post-deadline tail, or a slow click): fail loudly
    // instead of firing a request the server will silently reject after the card
    // would otherwise have unmounted.
    if (!open) {
      setOutcome("Palpites encerrados para esta partida.");
      return;
    }
    // Optimistic: show the palpite right away (greyed + shimmering), write in the
    // background, and revert it if the server rejects.
    setSent({ matchId: match.id, league: match.league, username: trimmed, predHome: home, predAway: away, createdAt: new Date().toISOString() });
    setSaving(true);
    setOutcome(null);
    const r = await castPalpite(match, name, home, away, entries, transport);
    setSaving(false);
    if (!r.ok) {
      setSent(null);
      setOutcome(r.message);
      return;
    }
    confirm(trimmed);
    onVoted();
  }

  return (
    <div className="bf-stack-card" style={{ flex: 1, minWidth: 0, borderRadius: 12, border: `1px solid ${borderColor}`, background: "rgba(255,255,255,0.02)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 11, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: JB, fontSize: 9.5, letterSpacing: "0.06em", color: "#6f8a78" }}>{groupVenue(match, groupByTeam) || "COPA DO MUNDO"}</span>
        {match.state === "in" ? (
          // Live: this card renders only during the kickoff+5min grace, so show
          // a live badge + how long palpites stay open (instead of a 00:00 clock).
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0, whiteSpace: "nowrap", fontFamily: JB, fontSize: 10, color: "#ffd9d9", background: "rgba(255,77,77,0.12)", border: "1px solid rgba(255,77,77,0.4)", borderRadius: 999, padding: "4px 10px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d", animation: "bfpulse 1.5s infinite" }} />
            AO VIVO
            <span style={{ fontSize: 9, color: "#e7b3b3", letterSpacing: "0.02em" }}>· fecha em <Countdown targetMs={effectiveDeadline(match.startsAt, openUntil)} render={(ms) => formatCountdown(Math.max(0, ms))} /></span>
          </span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0, whiteSpace: "nowrap", fontFamily: JB, fontSize: 10, color: "#cdeec0", background: "rgba(200,255,45,0.1)", border: "1px solid rgba(200,255,45,0.3)", borderRadius: 999, padding: "4px 10px" }}>
            <BfPulse />
            <Countdown targetMs={Date.parse(match.startsAt)} render={(ms) => (ms > 0 ? formatCountdownLong(ms) : "00:00")} />
            {/* Exact kickoff time, trailing the countdown as small dim text. */}
            <span style={{ fontSize: 9, color: "#8fae99", letterSpacing: "0.02em" }}>· {fmtTime(match.startsAt)}</span>
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FlagCrest code={homeCode} accent={homeAccent} size={34} />
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 16, color: homeAccent }}>{teamNamePt(homeCode, match.home.name).toUpperCase()}</span>
        </div>
        {match.state === "in" ? (
          <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 22, color: "#fff", whiteSpace: "nowrap", lineHeight: 1 }}>{match.homeScore ?? 0} <span style={{ color: "#42565b" }}>×</span> {match.awayScore ?? 0}</span>
        ) : (
          <span style={{ fontFamily: SAIRA, fontSize: 16, color: "#42565b" }}>×</span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 16, color: awayAccent }}>{teamNamePt(awayCode, match.away.name).toUpperCase()}</span>
          <FlagCrest code={awayCode} accent={awayAccent} size={34} />
        </div>
      </div>
      {released ? (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
            <Stepper label={homeCode} accent="var(--bf-text)" value={home} onChange={setHome} disabled={alreadySent} />
            <span style={{ fontFamily: SAIRA, fontSize: 22, color: "#42565b", paddingTop: 26 }}>×</span>
            <Stepper label={awayCode} accent="var(--bf-text)" value={away} onChange={setAway} disabled={alreadySent} />
          </div>
          {/* Per-game send button, right below this card's score steppers. Locked
              once sent OR once palpites close (kept visible during the tail). */}
          {(() => {
            const locked = alreadySent || !open;
            const nameMissing = !name.trim();
            const blocked = !locked && nameMissing; // require a name before sending
            const disabled = locked || saving || blocked;
            return (
              <button type="button" onClick={submit} disabled={disabled} className={saving ? "bf-saving" : undefined} style={{ flex: "none", textAlign: "center", backgroundColor: locked ? "rgba(255,255,255,0.05)" : LIME, color: locked ? "#7d9a86" : "#0f1f02", fontFamily: BRIC, fontWeight: 800, fontSize: 13, padding: "11px 12px", borderRadius: 10, border: locked ? "1px solid rgba(255,255,255,0.1)" : "none", boxShadow: locked || blocked ? "none" : "0 0 22px -10px rgba(200,255,45,0.6)", opacity: blocked ? 0.4 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
                {saving ? "SALVANDO…" : alreadySent ? "PALPITE ENVIADO ✓" : !open ? "PALPITES ENCERRADOS" : nameMissing ? "DIGITE SEU NOME" : "ENVIAR PALPITE →"}
              </button>
            );
          })()}
          {outcome ? (
            <div style={{ textAlign: "center", fontFamily: BRIC, fontSize: 11.5, color: "#ff6b6b" }}>{outcome}</div>
          ) : null}
        </>
      ) : (
        <div style={{ borderRadius: 9, border: "1px solid rgba(255,179,71,0.25)", background: "rgba(255,179,71,0.05)", padding: "10px 12px", textAlign: "center" }}>
          <span style={{ fontFamily: JB, fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "#ffb347" }}>Palpites não liberados ainda</span>
        </div>
      )}
      {/* "A comunidade palpita" — this game's live home/draw/away split. */}
      <CommunityBar consensus={consensus} homeCode={homeCode} awayCode={awayCode} homeAccent={homeAccent} awayAccent={awayAccent} />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.1em", color: "#6f8a78" }}>PALPITES ENVIADOS</span>
        <span style={{ fontFamily: JB, fontSize: 9, color: "#4d6353" }}>{visibleEntries.length}</span>
      </div>
      <SentList entries={visibleEntries} homeCode={homeCode} awayCode={awayCode} myName={myName} pendingName={saving ? lowerName : null} />
    </div>
  );
}

function PreMatchDuo({ match, second, entries, secondEntries, allEntries, matches, results, brackets, groupByTeam, released1, released2, openUntil1 = null, openUntil2 = null, onVoted, transport }: {
  match: Match;
  second: Match;
  entries: VoteEntry[];
  secondEntries: VoteEntry[];
  allEntries: VoteEntry[];
  matches: Match[];
  results?: Record<string, MatchResult>;
  brackets?: BracketEntry[];
  groupByTeam: Record<string, string>;
  released1: boolean;
  released2: boolean;
  openUntil1?: number | null;
  openUntil2?: number | null;
  onVoted: () => void;
  transport: CastVoteTransport;
}) {
  // One shared name; each game card sends its own palpite independently.
  const { name, setName, locked, confirm, unlock } = useNameLock();
  const narrow = useIsNarrow();

  return (
    <div style={{ display: "flex", flexDirection: narrow ? "column" : "row", gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: narrow ? "none" : 1, minWidth: 0, minHeight: 0 }}>
        <div style={{ flex: "none", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, borderRadius: 14, border: "1px solid rgba(200,255,45,0.16)", background: "rgba(255,255,255,0.02)", padding: "12px 20px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <NameField name={name} setName={setName} locked={locked} onUnlock={unlock} />
          </div>
          <span style={{ flex: "none", fontFamily: JB, fontSize: 9, color: "#6f8a78" }}>envie um palpite para cada jogo</span>
        </div>
        {/* The two game cards sit side by side on desktop, stacked on mobile. */}
        <div style={{ flex: narrow ? "none" : 1, minHeight: 0, display: "flex", flexDirection: narrow ? "column" : "row", gap: 16 }}>
          <DuoGameCard key={match.id} match={match} entries={entries} groupByTeam={groupByTeam} name={name} confirm={confirm} released={released1} openUntil={openUntil1} borderColor="rgba(229,68,59,0.18)" transport={transport} onVoted={onVoted} />
          <DuoGameCard key={second.id} match={second} entries={secondEntries} groupByTeam={groupByTeam} name={name} confirm={confirm} released={released2} openUntil={openUntil2} borderColor="rgba(63,164,95,0.18)" transport={transport} onVoted={onVoted} />
        </div>
      </div>
      {/* Ranking dos Subs on the right (desktop) / below the cards (mobile). */}
      <RankingSubs entries={allEntries} matches={matches} results={results} brackets={brackets} locked variant="column" style={{ flex: "none", width: narrow ? "100%" : 230 }} />
    </div>
  );
}
