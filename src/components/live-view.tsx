import { useEffect, useState } from "react";
import type { Match, MatchCard, MatchGoal, MatchLineups, MatchSub, Side, TeamLineup } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import type { ChipGame, ChipPhase } from "@/lib/chips";
import { fmtTime } from "@/lib/format";
import { palpiteDeadline, formatCountdownLong } from "@/lib/palpite";
import { rankSubs } from "@/lib/ranking";
import { MONO, DISPLAY, cardStyle, PulseDot } from "@/components/primitives";
import { PredictionPanel } from "@/components/prediction-panel";
import { ChipCarousel } from "@/components/chip-carousel";
import { Reactions } from "@/components/reactions";
import { Countdown } from "@/components/countdown";
import { teamLabel } from "@/components/match-meta";
import { LoopVideo } from "@/components/loop-video";
import { flagFileBase } from "@/lib/team-names";

const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** True once mounted if the URL has `?fx` — forces the live ambience on for a
 * demo even when no match is live (read after mount to avoid a hydration gap). */
function useFxForce(): boolean {
  const [force, setForce] = useState(false);
  useEffect(() => {
    try {
      // Intentional one-shot read after mount (avoids an SSR/CSR hydration gap).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForce(new URLSearchParams(window.location.search).has("fx"));
    } catch {
      /* ignore */
    }
  }, []);
  return force;
}

function groupLabel(m: Match, groupByTeam: Record<string, string>): string {
  const g = groupByTeam[m.home.abbreviation] ?? groupByTeam[m.away.abbreviation];
  return g ? `Grupo ${g}` : "";
}

function segBtn(active: boolean) {
  return {
    flex: "1 1 0",
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    background: active ? "var(--signal)" : "transparent",
    color: active ? "var(--signal-ink)" : "var(--ink-2)",
    border: `1px solid ${active ? "var(--signal)" : "var(--line-2)"}`,
    borderRadius: 999,
    padding: "8px",
    cursor: "pointer",
  };
}

function LineupBlock({ team, followCode }: { team: TeamLineup; followCode: string | null }) {
  const followed = team.code === followCode;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 19, letterSpacing: "-0.012em", color: followed ? "var(--signal-strong)" : "var(--ink)" }}>{team.code}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", color: "var(--ink-3)", whiteSpace: "nowrap" }}>{team.formation}</span>
      </div>
      {team.players.map((p, i) => (
        <div key={`${p.number}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: "1px solid var(--line)" }}>
          <span style={{ flex: "0 0 22px", fontFamily: MONO, fontSize: 12, color: "var(--signal-strong)", textAlign: "right" }}>{p.number}</span>
          <span style={{ flex: "0 0 26px", fontFamily: MONO, fontSize: 10, letterSpacing: "0.04em", color: "var(--ink-3)" }}>{p.pos}</span>
          <span style={{ flex: "1 1 auto", fontSize: 13, color: "var(--ink)" }}>{p.name}</span>
        </div>
      ))}
    </div>
  );
}

function SubsBlock({ subs, homeCode, awayCode }: { subs: MatchSub[]; homeCode: string; awayCode: string }) {
  if (subs.length === 0) return null;
  const codeFor = (s: MatchSub) => (s.side === "home" ? homeCode : awayCode);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 2 }}>Substituições</div>
      {subs.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: "1px solid var(--line)" }}>
          <span style={{ flex: "0 0 34px", fontFamily: MONO, fontSize: 12, color: "var(--signal-strong)" }}>{s.clock}</span>
          <span style={{ flex: "0 0 30px", fontFamily: MONO, fontSize: 10, letterSpacing: "0.04em", color: "var(--ink-3)" }}>{codeFor(s)}</span>
          <span style={{ flex: "1 1 auto", fontSize: 13, color: "var(--ink)" }}>
            <span style={{ color: "var(--signal-strong)" }}>▲</span> {s.playerIn}
            <span style={{ color: "var(--ink-3)" }}> ▼ {s.playerOut}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function LineupPanel({ lineups, followCode }: { lineups: MatchLineups | null; followCode: string | null }) {
  if (!lineups) {
    return <div style={{ padding: "20px 18px", fontSize: 13, color: "var(--ink-3)" }}>Escalações ainda não divulgadas.</div>;
  }
  return (
    <div style={{ flex: "1 1 auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", maxHeight: 580 }}>
      <LineupBlock team={lineups.home} followCode={followCode} />
      <LineupBlock team={lineups.away} followCode={followCode} />
      <SubsBlock subs={lineups.subs} homeCode={lineups.home.code} awayCode={lineups.away.code} />
    </div>
  );
}

function StatusLine({ match, phase }: { match: Match; phase: ChipPhase }) {
  if (phase === "live") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 12, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--signal-strong)" }}>
        <PulseDot size={8} />
        Ao vivo · {match.displayClock || match.statusDetail}
      </span>
    );
  }
  if (phase === "post") {
    return (
      <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-2)" }}>Encerrado</span>
    );
  }
  // pre: count down to kickoff; flips to the live clock once it starts.
  return (
    <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-2)" }}>
      <Countdown
        targetMs={Date.parse(match.startsAt)}
        render={(r) => (r > 0 ? `Começa em ${formatCountdownLong(r)}` : "Prestes a começar")}
      />
    </span>
  );
}

/** Minute used only for ordering; "45'+2'" sorts just after "45'". */
function clockOrder(clock: string): number {
  const m = clock.match(/(\d+)(?:'?\s*\+\s*(\d+))?/);
  if (!m) return 9999;
  return Number(m[1]) + (m[2] ? Number(m[2]) / 100 : 0);
}

/** A small colored booking rectangle (yellow / red). */
function CardChip({ kind }: { kind: "yellow" | "red" }) {
  return (
    <span
      aria-label={kind === "red" ? "Cartão vermelho" : "Cartão amarelo"}
      style={{
        display: "inline-block",
        width: 9,
        height: 12,
        borderRadius: 2,
        verticalAlign: "-1px",
        background: kind === "red" ? "var(--card-red)" : "var(--card-yellow)",
      }}
    />
  );
}

type FeedItem =
  | { kind: "goal"; side: Side; clock: string; order: number; goal: MatchGoal }
  | { kind: "card"; side: Side; clock: string; order: number; card: MatchCard };

/** Merge goals + cards for one side into a single chronological feed. */
function sideFeed(side: Side, goals: MatchGoal[], cards: MatchCard[]): FeedItem[] {
  const items: FeedItem[] = [
    ...goals.filter((g) => g.side === side).map((goal): FeedItem => ({ kind: "goal", side, clock: goal.clock, order: clockOrder(goal.clock), goal })),
    ...cards.filter((c) => c.side === side).map((card): FeedItem => ({ kind: "card", side, clock: card.clock, order: clockOrder(card.clock), card })),
  ];
  return items.sort((a, b) => a.order - b.order);
}

/** pt-BR suffix for special goals. */
function goalTag(g: MatchGoal): string {
  if (g.ownGoal) return " (contra)";
  if (g.penalty) return " (pênalti)";
  return "";
}

function FeedRow({ item, align }: { item: FeedItem; align: "left" | "right" }) {
  const clockEl = <span style={{ color: "var(--signal-strong)" }}>{item.clock}</span>;
  const body =
    item.kind === "goal" ? (
      <>
        ⚽ {item.goal.scorer}
        <span style={{ color: "var(--ink-3)" }}>{goalTag(item.goal)}</span>
      </>
    ) : (
      <>
        <CardChip kind={item.card.kind} /> {item.card.player}
      </>
    );
  return (
    <span style={{ fontFamily: MONO, fontSize: 15, color: "var(--ink)", display: "flex", gap: 8, justifyContent: align === "right" ? "flex-end" : "flex-start", alignItems: "center" }}>
      {align === "left" ? (
        <>
          {clockEl} <span>{body}</span>
        </>
      ) : (
        <>
          <span>{body}</span> {clockEl}
        </>
      )}
    </span>
  );
}

/**
 * Broadcast-style ambience layered into the hero, all seamlessly-looping videos
 * that also keep the compositor painting (so they double as keep-alive for an OBS
 * capture of the hero):
 *   - a dim, full-bleed pitch glow behind the score (live);
 *   - the followed team's flag (vendored SVG, real artwork), dim, with a sweeping
 *     shine overlay (shown whenever that team is in this match);
 *   - an always-shown "Ao vivo on [Kick]" lower-third (links to the stream).
 * `?fx` in the URL forces the live ambience on for a demo. pointer-events
 * disabled; the score content sits above (z-index 1).
 */
function HeroFx({ match, phase, followCode }: { match: Match; phase: ChipPhase; followCode: string | null }) {
  const force = useFxForce();
  const live = phase === "live" || force;
  const followed =
    followCode && (followCode === match.home.abbreviation || followCode === match.away.abbreviation)
      ? followCode
      : null;
  const flagBase = followed ? flagFileBase(followed) : "";
  return (
    <>
      {live ? (
        <LoopVideo
          srcs={["ambient-pitch.webm", "ambient-pitch.mp4"]}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.14, zIndex: 0, pointerEvents: "none" }}
        />
      ) : null}
      {flagBase ? (
        <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ASSET_BASE}/flags/${flagBase}.svg`} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.22 }} />
          <LoopVideo srcs={["flag-shine.mp4"]} blend style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3 }} />
        </div>
      ) : null}
      {/* "AO VIVO ON [Kick]" — always shown (it's the streamer's Kick, not the
          match), links to the live stream in a new tab. */}
      <a
        href="https://kick.com/locobaltar"
        target="_blank"
        rel="noopener noreferrer"
        title="Assistir ao vivo na Kick"
        style={{ position: "absolute", left: 16, bottom: 14, zIndex: 2, display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "rgba(0,0,0,0.45)", textDecoration: "none", color: "#fff" }}
      >
        <LoopVideo srcs={["live-dot.mp4"]} blend style={{ width: 16, height: 16, borderRadius: 999 }} />
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff" }}>Ao vivo na</span>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden style={{ flex: "0 0 auto" }}>
          <path fill="#53FC18" d="M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z" />
        </svg>
      </a>
    </>
  );
}

function BigDetail({ match, phase, followCode, groupByTeam, compact = false }: { match: Match; phase: ChipPhase; followCode: string | null; groupByTeam: Record<string, string>; compact?: boolean }) {
  const homeColor = match.home.abbreviation === followCode ? "var(--signal-strong)" : "var(--ink)";
  const awayColor = match.away.abbreviation === followCode ? "var(--signal-strong)" : "var(--ink)";
  const showScore = phase !== "pre";
  const homeFeed = sideFeed("home", match.goals, match.cards);
  const awayFeed = sideFeed("away", match.goals, match.cards);
  const hasFeed = homeFeed.length > 0 || awayFeed.length > 0;
  const meta = [groupLabel(match, groupByTeam), match.venue].filter(Boolean).join(" · ");
  // Compact tuning lets the hero share a row with the palpites + ranking columns
  // without the team abbreviations overflowing the narrower center column.
  const teamFont = compact ? "clamp(30px,3.4vw,58px)" : "clamp(38px,6.5vw,96px)";
  const labelFont = compact ? "clamp(12px,1.2vw,16px)" : "clamp(15px,2vw,22px)";
  const scoreFont = compact ? "clamp(34px,4vw,66px)" : "clamp(44px,7.5vw,108px)";
  const heroMax = compact ? 520 : 920;
  const heroGap = compact ? "clamp(10px,2vw,24px)" : "clamp(16px,4vw,48px)";
  const bodyMinH = compact ? "min(460px,54vh)" : "min(560px,62vh)";
  const bodyPad = compact ? "clamp(28px,3.5vw,44px) 20px" : "clamp(36px,6vw,64px) 24px";

  return (
    <div style={{ ...cardStyle, flex: "2 1 440px" }}>
      <div style={{ height: 4, background: "var(--signal)" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 24px", borderBottom: "1px solid var(--line)" }}>
        <StatusLine match={match} phase={phase} />
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-2)" }}>{meta}</span>
      </div>
      <div style={{ position: "relative", overflow: "hidden", minHeight: bodyMinH }}>
        <HeroFx match={match} phase={phase} followCode={followCode} />
        <div style={{ position: "relative", zIndex: 1, minHeight: bodyMinH, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: bodyPad, gap: 40 }}>
        <div style={{ width: "100%", maxWidth: heroMax, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: heroGap }}>
          <div style={{ textAlign: "right", minWidth: 0 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: teamFont, letterSpacing: "-0.03em", lineHeight: 0.92, color: homeColor }}>{match.home.abbreviation}</div>
            <div style={{ fontSize: labelFont, color: "var(--ink-2)", marginTop: 8 }}>{teamLabel(match.home.abbreviation, match.home.name)}</div>
          </div>
          {showScore ? (
            <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: scoreFont, letterSpacing: "-0.02em", lineHeight: 0.9, whiteSpace: "nowrap", color: "var(--ink)", textAlign: "center" }}>
              {match.homeScore ?? 0}–{match.awayScore ?? 0}
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: "0.10em", color: "var(--ink-3)" }}>VS</div>
              <div style={{ fontFamily: MONO, fontSize: 20, marginTop: 6, color: "var(--ink)" }}>{fmtTime(match.startsAt)}</div>
            </div>
          )}
          <div style={{ textAlign: "left", minWidth: 0 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: teamFont, letterSpacing: "-0.03em", lineHeight: 0.92, color: awayColor }}>{match.away.abbreviation}</div>
            <div style={{ fontSize: labelFont, color: "var(--ink-2)", marginTop: 8 }}>{teamLabel(match.away.abbreviation, match.away.name)}</div>
          </div>
        </div>
        {showScore && hasFeed ? (
          <div style={{ width: "100%", maxWidth: heroMax, paddingTop: 28, borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {homeFeed.map((item, i) => (
                <FeedRow key={i} item={item} align="left" />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {awayFeed.map((item, i) => (
                <FeedRow key={i} item={item} align="right" />
              ))}
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}

function RankingSidebar({ entries, matches }: { entries: VoteEntry[]; matches: Match[] }) {
  const byId: Record<string, Match> = {};
  for (const m of matches) byId[m.id] = m;
  const ranks = rankSubs(entries, byId);

  return (
    <div style={{ ...cardStyle, flex: "1 1 240px", minWidth: 220, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 4, background: "var(--rank)" }} />
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--rank)" }}>Ranking dos Subs</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>Vitórias &amp; derrotas · partidas encerradas</div>
      </div>
      {ranks.length === 0 ? (
        <div style={{ padding: "28px 16px", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>
          Sem palpites avaliados ainda. Volte após o fim das partidas.
        </div>
      ) : (
        <div style={{ overflowY: "auto", maxHeight: 580 }}>
          {ranks.map((r, i) => (
            <div
              key={r.username}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 16px",
                borderBottom: "1px solid var(--line)",
                background: i === 0 ? "rgba(250, 204, 21, 0.08)" : "transparent",
              }}
            >
              <span style={{ flex: "0 0 20px", textAlign: "right", fontFamily: MONO, fontSize: 12, color: i < 3 ? "var(--rank)" : "var(--ink-3)" }}>{i + 1}</span>
              <span style={{ flex: "1 1 auto", fontSize: 13, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.username}</span>
              <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 13, letterSpacing: "0.02em" }}>
                <span style={{ color: "var(--signal-strong)", fontWeight: 500 }}>{r.wins}</span>
                <span style={{ color: "var(--ink-3)" }}>–{r.losses}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export interface LiveViewProps {
  chips: ChipGame[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  panel: "predict" | "lineup";
  onPanel: (p: "predict" | "lineup") => void;
  lineups: MatchLineups | null;
  entries: VoteEntry[];
  allEntries: VoteEntry[];
  matches: Match[];
  onVoted: () => void;
  followCode: string | null;
  groupByTeam: Record<string, string>;
  releasedIds: Set<string>;
}

export function LiveView({
  chips,
  selectedId,
  onSelect,
  panel,
  onPanel,
  lineups,
  entries,
  allEntries,
  matches,
  onVoted,
  followCode,
  groupByTeam,
  releasedIds,
}: LiveViewProps) {
  const selected = chips.find((c) => c.match.id === selectedId) ?? chips[0];
  const liveCount = chips.filter((c) => c.phase === "live").length;

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        {liveCount > 0 ? (
          <>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: MONO, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--signal-strong)" }}>
              <PulseDot />
              Ao vivo agora
            </span>
            <span style={{ fontSize: 14, color: "var(--ink-3)" }}>
              {liveCount} {liveCount === 1 ? "partida em andamento" : "partidas em andamento"} · o placar atualiza a cada gol.
            </span>
          </>
        ) : (
          <>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-2)" }}>Palpites</span>
            <span style={{ fontSize: 14, color: "var(--ink-3)" }}>Jogos recentes e próximos — escolha um para palpitar ou ver os vencedores.</span>
          </>
        )}
      </div>

      {!selected ? (
        <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 24, letterSpacing: "-0.012em", color: "var(--ink-2)" }}>Nenhum jogo por enquanto</div>
          <div style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 8 }}>Volte perto dos próximos jogos.</div>
        </div>
      ) : (
        <>
          <Reactions matchId={selected.match.id} />
          <ChipCarousel chips={chips} selectedId={selected.match.id} onSelect={onSelect} releasedIds={releasedIds} />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
            <div style={{ ...cardStyle, flex: "1 1 280px", minWidth: 260, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", gap: 8, padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
                <button onClick={() => onPanel("predict")} style={segBtn(panel === "predict")}>
                  {selected.phase === "post" ? "Palpites" : "Palpite"}
                </button>
                <button onClick={() => onPanel("lineup")} style={segBtn(panel === "lineup")}>Escalação</button>
              </div>
              {panel === "predict" ? (
                <PredictionPanel
                  match={selected.match}
                  entries={entries}
                  current={{ home: selected.match.homeScore ?? 0, away: selected.match.awayScore ?? 0 }}
                  phase={selected.phase}
                  closesAt={palpiteDeadline(selected.match.startsAt)}
                  released={releasedIds.has(selected.match.id)}
                  onVoted={onVoted}
                />
              ) : (
                <LineupPanel lineups={lineups} followCode={followCode} />
              )}
            </div>

            <BigDetail match={selected.match} phase={selected.phase} followCode={followCode} groupByTeam={groupByTeam} compact />

            <RankingSidebar entries={allEntries} matches={matches} />
          </div>
        </>
      )}
    </section>
  );
}
