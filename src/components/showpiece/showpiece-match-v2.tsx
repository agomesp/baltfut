"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { VoteEntry } from "@/lib/votes";
import type { SubRank } from "@/lib/ranking";
import { buildChegandoRows, detectChegandoChanges } from "@/lib/chegando";
import { BRIC, SAIRA, JB, isMe, VoceTag, nameStyle } from "@/components/live/bf-ui";
import type { Dossier, Scenario, ShowpieceTheme } from "@/lib/showpiece/dossiers";
import {
  ShowpieceFrame,
  ShowpieceBanner,
  ShowpieceArena,
  LiveDeck,
  PathDeck,
  mono,
  type LiveStat,
} from "@/components/showpiece/showpiece-match";

/**
 * ShowpieceMatchV2 — the showpiece stage plus the live-engagement layer,
 * re-skinned to the marquee theme: the "DIGITE X×Y NO CHAT" call-to-action, the
 * live "PALPITES CHEGANDO" feed and the Ranking dos Subs.
 *
 * Data-agnostic: the caller supplies `entries` (palpites for this match) and
 * `ranks`, so the same component serves the REAL live view and the mock sandbox.
 */

const card = (theme: ShowpieceTheme, strong = false): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  minHeight: 0,
  borderRadius: 16,
  padding: 16,
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${strong ? theme.metal + "55" : "rgba(255,255,255,0.08)"}`,
  boxShadow: strong ? `inset 0 0 42px ${theme.metalSoft}` : "none",
});

// ---------------------------------------------------------------------------
// Chat CTA — "DIGITE X×Y NO CHAT"
// ---------------------------------------------------------------------------

function ChatCtaCard({ home, away, theme }: { home: Dossier; away: Dossier; theme: ShowpieceTheme }) {
  return (
    <div style={{ ...card(theme, true), gap: 15, justifyContent: "center" }}>
      <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: JB, fontSize: 11, letterSpacing: "0.08em", color: theme.key === "final" ? "#2a1c00" : "#241206", background: theme.metal, borderRadius: 999, padding: "5px 13px", fontWeight: 800 }}>
        ▶ PALPITE PELO CHAT DA KICK
      </span>
      <h2 style={{ margin: 0, fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(26px,3.4vw,46px)", lineHeight: 0.98, letterSpacing: "-0.02em", color: "#fff" }}>
        DIGITE <span style={{ color: theme.metal }}>2×1</span><br />NO CHAT
      </h2>
      <div style={{ fontFamily: BRIC, fontSize: "clamp(12px,1.2vw,16px)", color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}>
        Mande o placar no chat — <b style={{ color: "#fff" }}>1º número é o mandante</b> ({home.code}). Seu <b style={{ color: theme.metal }}>@nick</b> entra no Ranking dos Subs na hora.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 15px", borderRadius: 12, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)" }}>
        <span style={{ flex: "none", width: 27, height: 27, borderRadius: 7, background: "#53fc18", color: "#0a0a0a", fontFamily: BRIC, fontWeight: 900, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>K</span>
        <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontSize: 16, color: "rgba(255,255,255,0.5)" }}>
          Mensagem… <span style={{ color: "#fff", fontWeight: 800 }}>{home.code} 2x1 {away.code}</span>
          <span style={{ display: "inline-block", width: 2, height: 18, background: theme.metal, marginLeft: 3, verticalAlign: "-3px", animation: "spBlink 1s step-end infinite" }} />
        </span>
        <span style={{ flex: "none", fontFamily: JB, fontSize: 10.5, color: "rgba(255,255,255,0.4)" }}>ENVIAR ↵</span>
      </div>
      <span style={{ fontFamily: JB, fontSize: 11, color: theme.metal }}>✦ mandou de novo? troca o placar · vale até o apito inicial</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Palpites chegando
// ---------------------------------------------------------------------------

function ChegandoRow({ nick, value, fresh, changed, theme, myName }: { nick: string; value: string; fresh: boolean; changed: boolean; theme: ShowpieceTheme; myName: string | null }) {
  const bg = changed ? "rgba(255,205,50,0.15)" : fresh ? theme.metalSoft : "rgba(255,255,255,0.03)";
  const border = changed ? "1px solid rgba(255,205,50,0.6)" : fresh ? `1px solid ${theme.metal}55` : "1px solid rgba(255,255,255,0.05)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 13px", borderRadius: 11, background: bg, border, animation: "spChega .42s cubic-bezier(.2,.8,.2,1)" }}>
      <span style={{ flex: "none", width: 27, height: 27, borderRadius: 7, background: "#53fc18", color: "#0a0a0a", fontFamily: BRIC, fontWeight: 900, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>K</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontWeight: 700, fontSize: 16, ...nameStyle(nick, "#eef3ee"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nick}</span>
      {isMe(nick, myName) ? <VoceTag /> : null}
      <span style={{ flex: "none", fontFamily: SAIRA, fontWeight: 800, fontSize: 22, color: changed ? "#ffd24a" : "#fff" }}>{value}</span>
      <span style={{ flex: "none", fontFamily: JB, fontSize: 10, color: changed ? "#ffd24a" : theme.metal, fontWeight: 700 }}>{changed ? "alterado ⟳" : "✓"}</span>
    </div>
  );
}

/** The live feed of arriving palpites. `entries` is whatever the caller has —
 *  the REAL vote_entries for this match, or the sandbox's simulated stream. */
export function ChegandoPanel({ entries, home, away, theme, myName }: { entries: VoteEntry[]; home: Dossier; away: Dossier; theme: ShowpieceTheme; myName: string | null }) {
  // The real feed already has ONE row per user (a DB constraint) and
  // buildChegandoRows keys by username; collapse defensively (latest wins) so a
  // repeated nick can never produce duplicate keys.
  const deduped = useMemo(() => {
    const byUser = new Map<string, VoteEntry>();
    for (const e of entries) byUser.set(e.username, e);
    return [...byUser.values()];
  }, [entries]);

  const seenRef = useRef(new Map<string, string>());
  const [changedAt, setChangedAt] = useState<Map<string, number>>(() => new Map());
  useEffect(() => {
    const changed = detectChegandoChanges(deduped, seenRef.current, false, home.code, away.code);
    if (changed.length) {
      setChangedAt((cur) => {
        const next = new Map(cur);
        for (const u of changed) next.set(u, Date.parse(deduped.find((e) => e.username === u)?.createdAt ?? "") || deduped.length);
        return next;
      });
    }
  }, [deduped, home.code, away.code]);

  const rows = useMemo(
    () => buildChegandoRows(deduped, changedAt, false, home.code, away.code, 20),
    [deduped, changedAt, home.code, away.code],
  );

  return (
    <div style={{ ...card(theme), gap: 11 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={mono(11, "rgba(255,255,255,0.7)", "0.12em")}>PALPITES CHEGANDO</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: JB, fontSize: 9.5, color: theme.metal }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.metal, boxShadow: `0 0 7px ${theme.metal}`, animation: "spLive 1.3s infinite" }} /> AO VIVO
        </span>
      </div>
      <div className="bf-scroll" style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0, maxHeight: 340, overflowY: "auto", overflowX: "hidden", paddingRight: 4 }}>
        {rows.length === 0 ? (
          <div style={{ fontFamily: BRIC, fontSize: 12.5, color: "rgba(255,255,255,0.45)", padding: "8px 2px" }}>Nenhum palpite ainda — manda no chat!</div>
        ) : (
          rows.map((r, i) => (
            <ChegandoRow key={r.key} nick={r.nick} value={r.value} fresh={i === 0 && !r.changed} changed={r.changed} theme={theme} myName={myName} />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranking dos Subs (themed)
// ---------------------------------------------------------------------------

const fmtWins = (w: number) => (Number.isInteger(w) ? `${w}` : w.toFixed(1).replace(".", ","));

function RankRow({ r, rank, theme, myName }: { r: SubRank; rank: number; theme: ShowpieceTheme; myName: string | null }) {
  const you = isMe(r.username, myName);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderRadius: 9, background: you ? theme.metalSoft : "transparent", border: you ? `1px solid ${theme.metal}44` : "1px solid transparent" }}>
      <span style={{ width: 16, textAlign: "right", flex: "none", fontFamily: JB, fontSize: 10.5, color: rank <= 3 ? theme.metal : "rgba(255,255,255,0.4)" }}>{rank}</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontWeight: 600, fontSize: 12.5, ...nameStyle(r.username, "#e9ece8"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.username}</span>
      {you ? <VoceTag /> : null}
      <span style={{ flex: "none", display: "inline-flex", alignItems: "baseline", gap: 4, fontFamily: SAIRA, fontWeight: 700, fontSize: 13 }}>
        <span style={{ color: theme.metal }}>{fmtWins(r.wins)}</span>
        <span style={{ color: "rgba(255,255,255,0.32)" }}>–{r.losses}</span>
      </span>
      {r.penWins + r.penLosses > 0 ? (
        <span style={{ flex: "none", fontFamily: JB, fontSize: 8, color: "rgba(255,255,255,0.45)" }}>p {r.penWins}–{r.penLosses}</span>
      ) : null}
    </div>
  );
}

export function RankingPanel({ ranks, theme, myName }: { ranks: SubRank[]; theme: ShowpieceTheme; myName: string | null }) {
  const leader = ranks[0] ?? null;
  const rest = ranks.slice(1);
  return (
    <div style={{ ...card(theme, true), gap: 9 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: theme.metal }}>RANKING DOS SUBS</span>
        <span style={mono(8.5, "rgba(255,255,255,0.45)")}>V–D · pên</span>
      </div>
      {leader ? (
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 9, background: `linear-gradient(120deg, ${theme.metal}33, ${theme.metal}08)`, border: `1px solid ${theme.metal}66` }}>
          <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 17, color: theme.metal, width: 15, textAlign: "center" }}>1</span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontWeight: 800, fontSize: 13, ...nameStyle(leader.username, "#f3e2b0"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{leader.username}</span>
          {isMe(leader.username, myName) ? <VoceTag /> : null}
          <span style={{ flex: "none", fontFamily: JB, fontSize: 7, letterSpacing: "0.08em", color: theme.metal }}>LÍDER</span>
          <span style={{ flex: "none", fontFamily: SAIRA, fontWeight: 800, fontSize: 15, color: theme.metal }}>{fmtWins(leader.wins)}<span style={{ color: "rgba(255,255,255,0.32)", fontSize: 12 }}>–{leader.losses}</span></span>
        </div>
      ) : (
        <div style={{ fontFamily: BRIC, fontSize: 12.5, color: "rgba(255,255,255,0.45)", padding: "8px 2px" }}>Sem palpites avaliados ainda.</div>
      )}
      <div className="bf-scroll" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, maxHeight: 300, overflowY: "auto", overflowX: "hidden", paddingRight: 2 }}>
        {rest.map((r, i) => <RankRow key={r.username} r={r} rank={i + 2} theme={theme} myName={myName} />)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main v2
// ---------------------------------------------------------------------------

export interface ShowpieceMatchV2Props {
  scenario: Scenario;
  narrow?: boolean;
  /** Fill + scroll inside the live view (vs a growing card in the sandbox). */
  fill?: boolean;
  /** Palpites for THIS match — the "chegando" feed. */
  entries: VoteEntry[];
  /** Ranking rows, already computed (rankSubs output, or the sandbox's mock). */
  ranks: SubRank[];
  /** The viewer's nickname, for the VOCÊ highlight. */
  myName?: string | null;
  /** Head-to-head stats; omitted by the real view (ESPN has no such data). */
  stats?: LiveStat[];
}

export function ShowpieceMatchV2({ scenario, narrow = false, fill = false, entries, ranks, myName = null, stats }: ShowpieceMatchV2Props) {
  const { theme, home, away, match } = scenario;
  const live = match.state === "in";
  const engagementCols = narrow ? "1fr" : live ? "1fr 1fr" : "1.5fr 1.1fr 1fr";

  return (
    <ShowpieceFrame theme={theme} narrow={narrow} fill={fill}>
      <ShowpieceBanner theme={theme} narrow={narrow} />
      <ShowpieceArena scenario={scenario} narrow={narrow} />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
        {live && <LiveDeck scenario={scenario} narrow={narrow} stats={stats} />}

        <div style={{ display: "grid", gridTemplateColumns: engagementCols, gap: 14, alignItems: "stretch" }}>
          {!live && <ChatCtaCard home={home} away={away} theme={theme} />}
          <ChegandoPanel entries={entries} home={home} away={away} theme={theme} myName={myName} />
          <RankingPanel ranks={ranks} theme={theme} myName={myName} />
        </div>

        <PathDeck scenario={scenario} narrow={narrow} />
      </div>
    </ShowpieceFrame>
  );
}
