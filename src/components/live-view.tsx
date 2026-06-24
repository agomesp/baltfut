import { useEffect, useRef, useState } from "react";
import type { Match, MatchCard, MatchGoal, MatchLineups, MatchSub, Side, TeamLineup } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import type { ChipGame, ChipPhase } from "@/lib/chips";
import { fmtTime } from "@/lib/format";
import { palpiteDeadline, formatCountdownLong } from "@/lib/palpite";
import { rankSubs } from "@/lib/ranking";
import { MONO, DISPLAY, cardStyle, PulseDot } from "@/components/primitives";
import { PredictionPanel } from "@/components/prediction-panel";
import { ChipCarousel } from "@/components/chip-carousel";
import { PromoShowcase } from "@/components/promo-showcase";
import { Reactions } from "@/components/reactions";
import { Countdown } from "@/components/countdown";
import { teamLabel } from "@/components/match-meta";
import { LoopVideo } from "@/components/loop-video";
import { flagFileBase } from "@/lib/team-names";
import { PLAYER_CUTOUTS_ENABLED, craqueFor, playerCutoutSrc } from "@/lib/player-images";

const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** Height of the slim promo bar that sits on top of the live score. */
const PROMO_BAR_H = 60;


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

function FeedRow({ item, align, dense = false }: { item: FeedItem; align: "left" | "right"; dense?: boolean }) {
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
    <span style={{ fontFamily: MONO, fontSize: dense ? 11 : 15, color: "var(--ink)", display: "flex", gap: dense ? 5 : 8, justifyContent: align === "right" ? "flex-end" : "flex-start", alignItems: "center" }}>
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
 * The followed team's "craque" (star player) cutout, layered over the flag crest
 * in the hero. Flag-gated (PLAYER_CUTOUTS_ENABLED) + self-hosted under
 * public/players/. If the PNG is missing it hides itself (onError) so the flag
 * crest below shows through — the documented fallback. See
 * docs/player-images-spike.md.
 */
function CraqueCutout({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      onError={() => setFailed(true)}
      style={{
        position: "absolute",
        right: "3%",
        bottom: 0,
        height: "96%",
        width: "auto",
        maxWidth: "50%",
        objectFit: "contain",
        objectPosition: "bottom right",
        opacity: 0.9,
        filter: "drop-shadow(0 10px 26px rgba(0,0,0,0.5))",
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * Hero ambience (skipped in the dense/split view for perf). The full-bleed pitch
 * video was removed — keepalive is now the Modo Streamer PiP. Remaining:
 *   - the followed team's flag (vendored SVG), dim, with a sweeping shine overlay
 *     (shown whenever that team is in this match);
 *   - an always-shown "Ao vivo na [Kick]" lower-third (links to the stream).
 * pointer-events disabled; the score content sits above (z-index 1).
 */
function HeroFx({ match, followCode }: { match: Match; followCode: string | null }) {
  const followed =
    followCode && (followCode === match.home.abbreviation || followCode === match.away.abbreviation)
      ? followCode
      : null;
  const flagBase = followed ? flagFileBase(followed) : "";
  // Craque cutout (off by default): only when the flag is on AND the followed
  // team has a seeded star. Absent → null → the flag crest is the fallback.
  const craque = PLAYER_CUTOUTS_ENABLED && followed ? craqueFor(followed) : null;
  return (
    <>
      {flagBase ? (
        <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ASSET_BASE}/flags/${flagBase}.svg`} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.22 }} />
          <LoopVideo srcs={["flag-shine.mp4"]} blend style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3 }} />
          {craque ? <CraqueCutout src={playerCutoutSrc(craque.img, ASSET_BASE)} /> : null}
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
        {/* CSS-animated dot instead of a <video> — same look, one fewer decode. */}
        <span aria-hidden className="rec-blink" style={{ width: 9, height: 9, borderRadius: 999, background: "#e5484d", display: "inline-block", flex: "0 0 auto" }} />
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff" }}>Ao vivo na</span>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden style={{ flex: "0 0 auto" }}>
          <path fill="#53FC18" d="M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z" />
        </svg>
      </a>
    </>
  );
}

function BigDetail({ match, phase, followCode, groupByTeam, compact = false, dense = false }: { match: Match; phase: ChipPhase; followCode: string | null; groupByTeam: Record<string, string>; compact?: boolean; dense?: boolean }) {
  const homeColor = match.home.abbreviation === followCode ? "var(--signal-strong)" : "var(--ink)";
  const awayColor = match.away.abbreviation === followCode ? "var(--signal-strong)" : "var(--ink)";
  const showScore = phase !== "pre";
  const homeFeed = sideFeed("home", match.goals, match.cards);
  const awayFeed = sideFeed("away", match.goals, match.cards);
  const hasFeed = homeFeed.length > 0 || awayFeed.length > 0;
  const meta = [groupLabel(match, groupByTeam), match.venue].filter(Boolean).join(" · ");
  // Compact tuning lets the hero share a row with the palpites + ranking columns
  // without the team abbreviations overflowing the narrower center column.
  // `dense` is for the split (2-match) view — a score + feed must fit in HALF the
  // height, so everything shrinks and the hero anchors to the top (not centred,
  // which clipped the score). The ambient HeroFx is skipped entirely (perf + it
  // overlapped the goals in the short card).
  const teamFont = dense ? "clamp(13px,1.5vw,24px)" : compact ? "clamp(30px,3.4vw,58px)" : "clamp(38px,6.5vw,96px)";
  const labelFont = dense ? "clamp(8px,0.8vw,10px)" : compact ? "clamp(12px,1.2vw,16px)" : "clamp(15px,2vw,22px)";
  const scoreFont = dense ? "clamp(16px,1.9vw,30px)" : compact ? "clamp(34px,4vw,66px)" : "clamp(44px,7.5vw,108px)";
  const heroMax = dense ? 560 : compact ? 520 : 920;
  const heroGap = dense ? "clamp(6px,1.2vw,14px)" : compact ? "clamp(10px,2vw,24px)" : "clamp(16px,4vw,48px)";
  const bodyPad = dense ? "8px 14px 10px" : compact ? "clamp(28px,3.5vw,44px) 20px" : "clamp(36px,6vw,64px) 24px";
  const heroStackGap = dense ? 8 : 40;
  const labelMt = dense ? 2 : 8;
  const headerPad = dense ? "7px 14px" : "16px 24px";
  // Hero centres when there's no goal/card feed; tops-anchors (so the feed can
  // scroll below it) when there is one.
  const hasScrollFeed = showScore && hasFeed;
  const feedPadTop = dense ? 10 : 28;
  const feedColGap = dense ? 12 : 24;
  const feedRowGap = dense ? 4 : 8;

  return (
    <div style={{ ...cardStyle, flex: "2 1 440px", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      <div style={{ height: 4, background: "var(--signal)", flex: "0 0 auto" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: headerPad, borderBottom: "1px solid var(--line)", flex: "0 0 auto" }}>
        <StatusLine match={match} phase={phase} />
        <span style={{ fontFamily: MONO, fontSize: dense ? 9 : 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-2)" }}>{meta}</span>
      </div>
      <div style={{ position: "relative", overflow: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {dense ? null : <HeroFx match={match} followCode={followCode} />}
        <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: hasScrollFeed ? "flex-start" : "center", padding: bodyPad, gap: heroStackGap }}>
        <div style={{ width: "100%", maxWidth: heroMax, flexShrink: 0, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: heroGap }}>
          <div style={{ textAlign: "right", minWidth: 0 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: teamFont, letterSpacing: "-0.03em", lineHeight: 0.92, color: homeColor }}>{match.home.abbreviation}</div>
            <div style={{ fontSize: labelFont, color: "var(--ink-2)", marginTop: labelMt }}>{teamLabel(match.home.abbreviation, match.home.name)}</div>
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
            <div style={{ fontSize: labelFont, color: "var(--ink-2)", marginTop: labelMt }}>{teamLabel(match.away.abbreviation, match.away.name)}</div>
          </div>
        </div>
        {hasScrollFeed ? (
          <div style={{ width: "100%", maxWidth: heroMax, flex: "1 1 0", minHeight: 0, overflowY: "auto", alignContent: "start", paddingTop: feedPadTop, borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: feedColGap }}>
            <div style={{ display: "flex", flexDirection: "column", gap: feedRowGap }}>
              {homeFeed.map((item, i) => (
                <FeedRow key={i} item={item} align="left" dense={dense} />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: feedRowGap }}>
              {awayFeed.map((item, i) => (
                <FeedRow key={i} item={item} align="right" dense={dense} />
              ))}
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}

/** One live match in the split (2-match) view: its palpites panel + a dense score. */
function MatchBlock({
  match,
  entries,
  onVoted,
  releasedIds,
  followCode,
  groupByTeam,
}: {
  match: Match;
  entries: VoteEntry[];
  onVoted: () => void;
  releasedIds: Set<string>;
  followCode: string | null;
  groupByTeam: Record<string, string>;
}) {
  return (
    <div style={{ flex: "1 1 0", minHeight: 0, display: "flex", gap: 16, alignItems: "stretch" }}>
      <div style={{ ...cardStyle, flex: "1 1 240px", minWidth: 220, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        <PredictionPanel
          match={match}
          entries={entries}
          current={{ home: match.homeScore ?? 0, away: match.awayScore ?? 0 }}
          phase="live"
          closesAt={palpiteDeadline(match.startsAt)}
          released={releasedIds.has(match.id)}
          onVoted={onVoted}
          dense
        />
      </div>
      <BigDetail match={match} phase="live" followCode={followCode} groupByTeam={groupByTeam} compact dense />
    </div>
  );
}

function RankingSidebar({ entries, matches, width }: { entries: VoteEntry[]; matches: Match[]; width?: number }) {
  const byId: Record<string, Match> = {};
  for (const m of matches) byId[m.id] = m;
  const ranks = rankSubs(entries, byId);

  return (
    <div style={{ ...cardStyle, flex: width ? `0 0 ${width}px` : "1 1 240px", minWidth: width ? 180 : 220, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      <div style={{ height: 4, background: "var(--rank)", flex: "0 0 auto" }} />
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", flex: "0 0 auto" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--rank)" }}>Ranking dos Subs</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>Vitórias &amp; derrotas · partidas encerradas</div>
      </div>
      {ranks.length === 0 ? (
        <div style={{ padding: "28px 16px", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>
          Sem palpites avaliados ainda. Volte após o fim das partidas.
        </div>
      ) : (
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
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
              <span style={{ flex: "1 1 auto", fontSize: 13, fontWeight: r.username.toLowerCase() === "chatgpt" ? 600 : 400, color: r.username.toLowerCase() === "chatgpt" ? "#a78bfa" : "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.username}</span>
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
  // 2+ live matches → split the main area into one stacked block per live match
  // (each with its own palpites + score); the ranking column stays whole.
  // BUT only while a LIVE match is selected: clicking a next/previous (pre/post)
  // chip drops to the single view of that match; clicking any live chip again
  // brings the split back with both.
  const liveMatches = chips.filter((c) => c.phase === "live").map((c) => c.match);
  const splitMode = liveMatches.length >= 2 && selected?.phase === "live";

  // Make the live layout fill the viewport on wide screens, so the page itself
  // doesn't scroll top-to-bottom — each column scrolls internally instead. Sized
  // in JS off the row's own top, so it adapts to the (responsively wrapping)
  // header + status + pills above it. BOTTOM_GAP keeps the floating bottom
  // buttons (reactions bar, PiP/Modo Streamer) clear of the column contents.
  // Narrow screens reset to natural flow (columns wrap, page scrolls normally).
  const fillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    const WIDE_MIN = 1000;
    const BOTTOM_GAP = 92;
    const apply = () => {
      if (window.innerWidth < WIDE_MIN) {
        el.style.height = "";
        el.style.overflow = "";
        el.style.flexWrap = "";
        return;
      }
      el.style.flexWrap = "nowrap";
      el.style.overflow = "hidden";
      // The promo bar is in flow above this row, so its height is already counted
      // in `top` — just fill from here to the bottom gap.
      const top = el.getBoundingClientRect().top;
      el.style.height = `${Math.max(300, window.innerHeight - top - BOTTOM_GAP)}px`;
    };
    apply();
    const raf = requestAnimationFrame(apply); // re-measure after fonts/layout settle
    window.addEventListener("resize", apply);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", apply);
    };
  }, [selected?.match.id, liveCount]);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 5 }}>
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
          {/* Slim promo bar on top of the live score, full width. */}
          <PromoShowcase height={PROMO_BAR_H} />
          <div ref={fillRef} style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch", minHeight: 0 }}>
            {splitMode ? (
              // 2+ live matches: stack them (each its own palpites + score) and keep
              // a single Ranking dos Subs column stretched the full height.
              <>
                <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
                  {liveMatches.map((m) => (
                    <MatchBlock
                      key={m.id}
                      match={m}
                      entries={allEntries.filter((e) => e.matchId === m.id)}
                      onVoted={onVoted}
                      releasedIds={releasedIds}
                      followCode={followCode}
                      groupByTeam={groupByTeam}
                    />
                  ))}
                </div>
                <RankingSidebar entries={allEntries} matches={matches} width={206} />
              </>
            ) : (
              <>
                <div style={{ ...cardStyle, flex: "1 1 280px", minWidth: 260, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                  <div style={{ display: "flex", gap: 8, padding: "14px 16px", borderBottom: "1px solid var(--line)", flex: "0 0 auto" }}>
                    <button onClick={() => onPanel("predict")} style={segBtn(panel === "predict")}>
                      {selected.phase === "post" ? "Palpites" : "Palpite"}
                    </button>
                    <button onClick={() => onPanel("lineup")} style={segBtn(panel === "lineup")}>Escalação</button>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
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
                </div>

                <BigDetail match={selected.match} phase={selected.phase} followCode={followCode} groupByTeam={groupByTeam} compact />

                <RankingSidebar entries={allEntries} matches={matches} />
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
