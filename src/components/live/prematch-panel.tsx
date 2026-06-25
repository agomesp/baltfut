"use client";

import { useEffect, useState } from "react";
import type { Match } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import { supabaseCastVote, type CastVoteTransport } from "@/lib/votes";
import { teamNamePt } from "@/lib/team-names";
import { teamCupHistory, type TeamHistoryGame } from "@/lib/team-history";
import { palpiteDeadline, formatCountdownLong } from "@/lib/palpite";
import { Countdown } from "@/components/countdown";
import { RankingSubs } from "@/components/live/ranking-subs";
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
  FlagCrest,
  GOLD,
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
function KickoffClock({ startsAt }: { startsAt: string }) {
  return (
    <Countdown
      targetMs={Date.parse(startsAt)}
      render={(ms) => {
        if (ms <= 0) return <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 36, color: "#fff", lineHeight: 0.78 }}>00:00</span>;
        const parts = formatCountdownLong(ms).split(":");
        return (
          <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 36, color: "#fff", lineHeight: 0.78, letterSpacing: "0.02em" }}>
            {parts.map((p, i) => (
              <span key={i}>
                {i > 0 ? <span style={{ color: LIME }}>:</span> : null}
                {p}
              </span>
            ))}
          </span>
        );
      }}
    />
  );
}

function SentList({ entries, homeCode, awayCode, myName, cols = 2 }: { entries: VoteEntry[]; homeCode: string; awayCode: string; myName: string | null; cols?: number }) {
  return (
    <div className="bf-scroll" style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "7px 8px", alignContent: "start", flex: 1, minHeight: 0, paddingRight: 4, overflowY: "auto", overflowX: "hidden" }}>
      {entries.length === 0 ? (
        <div style={{ fontFamily: BRIC, fontSize: 11.5, color: "#6f8a78" }}>Nenhum palpite ainda. Seja o primeiro.</div>
      ) : (
        entries.map((e, i) => {
          const mine = myName != null && e.username.trim().toLowerCase() === myName.trim().toLowerCase();
          return (
            <div key={`${e.username}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 7, padding: "6px 8px", background: mine ? "rgba(200,255,45,0.1)" : "rgba(255,255,255,0.025)", border: mine ? "1px solid rgba(200,255,45,0.4)" : "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontFamily: BRIC, fontWeight: 700, fontSize: 11.5, ...nameStyle(e.username, "#eef3ee"), flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.username}</span>
              {mine ? <span style={{ flex: "none", fontFamily: JB, fontSize: 7.5, letterSpacing: "0.06em", fontWeight: 700, color: "#0f1f02", background: LIME, padding: "2px 5px", borderRadius: 4 }}>VOCÊ</span> : null}
              <span style={{ flex: "none", fontFamily: JB, fontSize: 9.5, color: "#aebdb4" }}>{pickLine(e, homeCode, awayCode)}</span>
            </div>
          );
        })
      )}
    </div>
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

function PreHero({ match, groupByTeam }: { match: Match; groupByTeam: Record<string, string> }) {
  const homeAccent = teamAccent(match.home.abbreviation);
  const awayAccent = teamAccent(match.away.abbreviation);
  return (
    <div style={{ position: "relative", flex: "none", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,179,71,0.16)", background: "linear-gradient(180deg, rgba(255,179,71,0.06), transparent)", padding: "14px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(12px,3vw,30px)" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, minWidth: 0 }}>
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(16px,2vw,23px)", letterSpacing: "-0.02em", color: homeAccent, whiteSpace: "nowrap" }}>{teamNamePt(match.home.abbreviation, match.home.name).toUpperCase()}</span>
          <FlagCrest code={match.home.abbreviation} accent={homeAccent} size={50} />
        </div>
        <div style={{ flex: "none", textAlign: "center" }}>
          <div style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.2em", color: GOLD, marginBottom: 6 }}>COMEÇA EM</div>
          <KickoffClock startsAt={match.startsAt} />
          <div style={{ fontFamily: JB, fontSize: 9, color: "#6f8a78", marginTop: 9, letterSpacing: "0.05em" }}>{groupVenue(match, groupByTeam) || "COPA DO MUNDO"}</div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <FlagCrest code={match.away.abbreviation} accent={awayAccent} size={50} />
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(16px,2vw,23px)", letterSpacing: "-0.02em", color: awayAccent, whiteSpace: "nowrap" }}>{teamNamePt(match.away.abbreviation, match.away.name).toUpperCase()}</span>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 14 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: JB, fontSize: 10, color: "#cdeec0", background: "rgba(200,255,45,0.1)", border: "1px solid rgba(200,255,45,0.3)", borderRadius: 999, padding: "6px 15px" }}>
          <BfPulse />PALPITES ABERTOS · feche o seu antes do apito inicial
        </span>
      </div>
    </div>
  );
}

const cardWrap = { borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" } as const;

export interface PreMatchPanelProps {
  match: Match;
  /** Simultaneous partner to co-show (the AUTO duo); null = single game. */
  second: Match | null;
  entries: VoteEntry[];
  secondEntries: VoteEntry[];
  allEntries: VoteEntry[];
  matches: Match[];
  groupByTeam: Record<string, string>;
  /** Matches open for palpites (current + next kickoff group). */
  releasedIds: Set<string>;
  onVoted: () => void;
  transport?: CastVoteTransport;
}

export function PreMatchPanel({ match, second, entries, secondEntries, allEntries, matches, groupByTeam, releasedIds, onVoted, transport = supabaseCastVote }: PreMatchPanelProps) {
  const { name } = useNameLock();
  const myName = name || null;
  const homeCode = match.home.abbreviation;
  const awayCode = match.away.abbreviation;
  const homeAccent = teamAccent(homeCode);
  const awayAccent = teamAccent(awayCode);
  // The parent (decideConcurrent) only hands us a `second` when it wants the duo,
  // so simply mirror that — AUTO with a simultaneous partner shows both games.
  const showDuo = second != null;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 11, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
        <SectionLabel color={GOLD}>{"// PALPITES ABERTOS"}</SectionLabel>
      </div>

      {!showDuo ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 11, flex: 1, minHeight: 0 }}>
          <PreHero match={match} groupByTeam={groupByTeam} />
          <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
            <RankingSubs entries={allEntries} matches={matches} variant="column" style={{ flex: "none", width: 170 }} />
            <div style={{ ...cardWrap, flex: 1.35, minWidth: 0, minHeight: 0, overflow: "hidden", border: "1px solid rgba(200,255,45,0.16)", padding: "13px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <SectionLabel>{"// FAÇA SEU PALPITE"}</SectionLabel>
              <PalpiteForm match={match} entries={entries} closesAt={palpiteDeadline(match.startsAt)} released={releasedIds.has(match.id)} onVoted={onVoted} transport={transport} />
              <div className="bf-scroll" style={{ display: "flex", gap: 12, flex: 1, minHeight: 0, alignItems: "flex-start", paddingRight: 4, overflowY: "auto", overflowX: "hidden" }}>
                <HistoryColumn code={homeCode} accent={homeAccent} games={teamCupHistory(matches, homeCode)} />
                <HistoryColumn code={awayCode} accent={awayAccent} games={teamCupHistory(matches, awayCode)} />
              </div>
            </div>
            <div style={{ ...cardWrap, flex: 1.05, minWidth: 0, padding: 14, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 11 }}>
                <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 14 }}>Palpites enviados</span>
                <span style={{ fontFamily: JB, fontSize: 9.5, color: "#6f8a78" }}>{entries.length} no total</span>
              </div>
              <SentList entries={entries} homeCode={homeCode} awayCode={awayCode} myName={myName} />
            </div>
          </div>
        </div>
      ) : (
        <PreMatchDuo
          match={match}
          second={second!}
          entries={entries}
          secondEntries={secondEntries}
          groupByTeam={groupByTeam}
          released1={releasedIds.has(match.id)}
          released2={releasedIds.has(second!.id)}
          onVoted={onVoted}
          transport={transport}
        />
      )}
    </section>
  );
}

function DuoGameCard({ match, entries, groupByTeam, name, confirm, released, borderColor, transport, onVoted }: {
  match: Match;
  entries: VoteEntry[];
  groupByTeam: Record<string, string>;
  /** Shared (locked/typed) name from the panel header. */
  name: string;
  confirm: (n: string) => void;
  released: boolean;
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
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  // Optimistic lock: on a successful send, hold the palpite locally so the name
  // shows in the list + the card greys out immediately, before the refetch lands.
  const [sent, setSent] = useState<VoteEntry | null>(null);
  const myName = name.trim() || null;

  useEffect(() => {
    if (!outcome || outcome.ok) return;
    const id = window.setTimeout(() => setOutcome(null), 5000);
    return () => window.clearTimeout(id);
  }, [outcome]);

  const lowerName = name.trim().toLowerCase();
  const meInEntries = lowerName !== "" && entries.some((x) => x.username.trim().toLowerCase() === lowerName);
  const alreadySent = meInEntries || sent != null;
  const shownEntries = sent && !meInEntries ? [sent, ...entries] : entries;

  async function submit() {
    setSubmitting(true);
    setOutcome(null);
    const r = await castPalpite(match, name, home, away, entries, transport);
    setSubmitting(false);
    if (!r.ok) {
      setOutcome({ ok: false, text: r.message });
      return;
    }
    setSent({ matchId: match.id, league: match.league, username: name.trim(), predHome: home, predAway: away, createdAt: new Date().toISOString() });
    confirm(name.trim());
    onVoted();
  }

  return (
    <div style={{ flex: 1, minWidth: 0, borderRadius: 12, border: `1px solid ${borderColor}`, background: "rgba(255,255,255,0.02)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 11, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: JB, fontSize: 9.5, letterSpacing: "0.06em", color: "#6f8a78" }}>{groupVenue(match, groupByTeam) || "COPA DO MUNDO"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: JB, fontSize: 10, color: "#cdeec0", background: "rgba(200,255,45,0.1)", border: "1px solid rgba(200,255,45,0.3)", borderRadius: 999, padding: "4px 10px" }}>
          <BfPulse />
          <Countdown targetMs={Date.parse(match.startsAt)} render={(ms) => (ms > 0 ? formatCountdownLong(ms) : "00:00")} />
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FlagCrest code={homeCode} accent={homeAccent} size={34} />
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 16, color: homeAccent }}>{teamNamePt(homeCode, match.home.name).toUpperCase()}</span>
        </div>
        <span style={{ fontFamily: SAIRA, fontSize: 16, color: "#42565b" }}>×</span>
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
          {/* Per-game send button, right below this card's score steppers. */}
          <button type="button" onClick={submit} disabled={submitting || alreadySent} style={{ flex: "none", textAlign: "center", background: alreadySent ? "rgba(255,255,255,0.05)" : LIME, color: alreadySent ? "#7d9a86" : "#0f1f02", fontFamily: BRIC, fontWeight: 800, fontSize: 13, padding: "11px 12px", borderRadius: 10, border: alreadySent ? "1px solid rgba(255,255,255,0.1)" : "none", boxShadow: alreadySent ? "none" : "0 0 22px -10px rgba(200,255,45,0.6)", opacity: submitting ? 0.6 : 1, cursor: submitting || alreadySent ? "not-allowed" : "pointer" }}>
            {submitting ? "ENVIANDO…" : alreadySent ? "PALPITE ENVIADO ✓" : "ENVIAR PALPITE →"}
          </button>
          {outcome ? (
            <div style={{ textAlign: "center", fontFamily: BRIC, fontSize: 11.5, color: outcome.ok ? LIME : "#ff6b6b" }}>{outcome.text}</div>
          ) : null}
        </>
      ) : (
        <div style={{ borderRadius: 9, border: "1px solid rgba(255,179,71,0.25)", background: "rgba(255,179,71,0.05)", padding: "10px 12px", textAlign: "center" }}>
          <span style={{ fontFamily: JB, fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "#ffb347" }}>Palpites não liberados ainda</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.1em", color: "#6f8a78" }}>PALPITES ENVIADOS</span>
        <span style={{ fontFamily: JB, fontSize: 9, color: "#4d6353" }}>{shownEntries.length}</span>
      </div>
      <SentList entries={shownEntries} homeCode={homeCode} awayCode={awayCode} myName={myName} />
    </div>
  );
}

function PreMatchDuo({ match, second, entries, secondEntries, groupByTeam, released1, released2, onVoted, transport }: {
  match: Match;
  second: Match;
  entries: VoteEntry[];
  secondEntries: VoteEntry[];
  groupByTeam: Record<string, string>;
  released1: boolean;
  released2: boolean;
  onVoted: () => void;
  transport: CastVoteTransport;
}) {
  // One shared name; each game card sends its own palpite independently.
  const { name, setName, locked, confirm, unlock } = useNameLock();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minHeight: 0 }}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 16, borderRadius: 14, border: "1px solid rgba(200,255,45,0.16)", background: "rgba(255,255,255,0.02)", padding: "12px 20px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <NameField name={name} setName={setName} locked={locked} onUnlock={unlock} />
        </div>
        <span style={{ flex: "none", fontFamily: JB, fontSize: 9, color: "#6f8a78" }}>envie um palpite para cada jogo</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 16 }}>
        <DuoGameCard key={match.id} match={match} entries={entries} groupByTeam={groupByTeam} name={name} confirm={confirm} released={released1} borderColor="rgba(229,68,59,0.18)" transport={transport} onVoted={onVoted} />
        <DuoGameCard key={second.id} match={second} entries={secondEntries} groupByTeam={groupByTeam} name={name} confirm={confirm} released={released2} borderColor="rgba(63,164,95,0.18)" transport={transport} onVoted={onVoted} />
      </div>
    </div>
  );
}
