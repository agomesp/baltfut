"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion, useTransform } from "framer-motion";
import confetti from "canvas-confetti";
import type { SubRank } from "@/lib/ranking";
import type { AccuracyRow, ChampionsBoard, HalfPointRow, VolumeRow } from "@/lib/champions/rankings";
import { usePointer3D } from "@/components/live/fx";
import { BRIC, SAIRA, JB, teamAccent, nameStyle } from "@/components/live/bf-ui";
import { flagFileBase, teamNamePt } from "@/lib/team-names";
import { ASSET_BASE } from "@/components/live/bf-ui";

/**
 * The closing ceremony: a full-screen, staged reveal of how the subs finished the
 * tournament. Runs once the final is over.
 *
 * Choreography — the boards land one at a time so the room can react:
 *   0 plaque → 1 podium rises 10→1 (champion last, with confetti) → 2 the 0,5
 *   board → 3 volume + accuracy → 4 "alive", a slow loop that never ends.
 *
 * Entrances are framer-motion (transform/opacity → compositor); the idle loop is
 * CSS. `prefers-reduced-motion` collapses the whole thing to a static board.
 */

// Stage timings (ms). Deliberately unhurried — this is the payoff screen.
const T_PODIUM = 900;
const ROW_STEP = 420;
const T_HALF = T_PODIUM + ROW_STEP * 10 + 1200;
const T_SIDE = T_HALF + 900;
const T_ALIVE = T_SIDE + 1100;

const GOLD = "#ffd76a";
const GOLD_DEEP = "#e8b53a";

const mono = (size: number, color: string, ls = "0.14em"): CSSProperties => ({
  fontFamily: JB,
  fontSize: size,
  letterSpacing: ls,
  color,
  textTransform: "uppercase",
});

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1).replace(".", ","));
const pct = (n: number) => `${Math.round(n * 100)}%`;

function fireConfetti(colors: string[]) {
  const shoot = (particleRatio: number, opts: confetti.Options) =>
    confetti({ origin: { y: 0.62 }, colors, disableForReducedMotion: true, particleCount: Math.floor(220 * particleRatio), ...opts });
  shoot(0.25, { spread: 26, startVelocity: 55 });
  shoot(0.2, { spread: 60 });
  shoot(0.35, { spread: 100, decay: 0.91, scalar: 0.9 });
  shoot(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  shoot(0.1, { spread: 120, startVelocity: 45 });
}

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

function Panel({
  title,
  sub,
  accent,
  delay,
  show,
  settled,
  children,
  style,
}: {
  title: string;
  sub?: string;
  accent: string;
  delay: number;
  show: boolean;
  settled?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const Box = settled ? "section" : motion.section;
  const anim = settled
    ? {}
    : {
        initial: { opacity: 0, y: 40, rotateX: 12 },
        animate: show ? { opacity: 1, y: 0, rotateX: 0 } : undefined,
        transition: { delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
      };
  return (
    <Box
      {...anim}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
        gap: 9,
        padding: "14px 16px",
        borderRadius: 16,
        background: "rgba(255,255,255,0.035)",
        border: `1px solid ${accent}44`,
        boxShadow: `inset 0 0 46px ${accent}14`,
        backdropFilter: "blur(3px)",
        ...style,
      }}
    >
      <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 15, color: accent, lineHeight: 1.1 }}>{title}</span>
        {sub ? <span style={mono(8.5, "rgba(255,255,255,0.5)", "0.08em")}>{sub}</span> : null}
      </div>
      <div className="bf-scroll" style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", paddingRight: 3 }}>
        {children}
      </div>
    </Box>
  );
}

const SEATED = { opacity: 1, y: 0, scale: 1, rotateX: 0 } as const;

/** Animates in, but drops to a plain node once the ceremony's clock is up — see
 *  the note on {@link Row} for why the element type has to change. */
function Reveal({
  settled,
  initial,
  animate,
  transition,
  style,
  className,
  children,
}: {
  settled: boolean;
  initial: Record<string, number>;
  animate: Record<string, number>;
  transition: Record<string, unknown>;
  /** `transformPerspective` is framer-motion's own style key, not standard CSS. */
  style?: CSSProperties & { transformPerspective?: number };
  className?: string;
  children: ReactNode;
}) {
  if (settled) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div initial={initial} animate={animate} transition={transition} style={style} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * One row that flies in from below with a touch of 3D tilt.
 *
 * `settled` is a safety net, not decoration: if the animation driver ever stalls
 * (a throttled/occluded tab pauses rAF mid-flight), the choreography would leave
 * rows frozen at opacity 0 — invisible on a screen whose entire job is showing
 * them. Once the ceremony's clock says it should be done, rows snap to their
 * final state regardless of what the animations managed to do.
 */
function Row({
  delay,
  show,
  settled,
  champion,
  children,
}: {
  delay: number;
  show: boolean;
  settled: boolean;
  champion?: boolean;
  children: ReactNode;
}) {
  // Swapping the element type (motion.div → div) is what makes this a real
  // guarantee: flipping a prop wouldn't help, because `animate` is already SEATED
  // by then, so the library sees no new target and a stalled animation would just
  // stay stalled. A plain node has no driver to stall.
  if (settled) {
    return <div className={champion ? "bf-champ-row" : undefined}>{children}</div>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 46, scale: 0.94, rotateX: 34 }}
      animate={show ? SEATED : undefined}
      transition={{ delay, type: "spring", stiffness: 170, damping: 18, mass: 0.8 }}
      style={{ transformPerspective: 900 }}
      className={champion ? "bf-champ-row" : undefined}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export interface ChampionsScreenProps {
  winnerCode: string;
  board: ChampionsBoard;
  half: HalfPointRow[];
  volume: VolumeRow[];
  accuracy: AccuracyRow[];
  best: AccuracyRow[];
  minPalpites: number;
  minBest: number;
  onBack: () => void;
}

export function ChampionsScreen({
  winnerCode,
  board,
  half,
  volume,
  accuracy,
  best,
  minPalpites,
  minBest,
  onBack,
}: ChampionsScreenProps) {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(reduced ? 4 : 0);
  const firedRef = useRef(false);
  const accent = teamAccent(winnerCode);
  const winnerName = teamNamePt(winnerCode, winnerCode);
  const flag = flagFileBase(winnerCode);

  // Reversed podium order: the board fills from the bottom rung upward, so the
  // champion is the last thing to land.
  const podium = board.top;
  const settled = stage >= 4;
  const rowDelay = (i: number) => ((podium.length - 1 - i) * ROW_STEP) / 1000;

  useEffect(() => {
    if (reduced) return;
    const t = [
      setTimeout(() => setStage(1), T_PODIUM),
      setTimeout(() => setStage(2), T_HALF),
      setTimeout(() => setStage(3), T_SIDE),
      setTimeout(() => setStage(4), T_ALIVE),
    ];
    return () => t.forEach(clearTimeout);
  }, [reduced]);

  // Confetti the moment the champion's row lands.
  useEffect(() => {
    if (reduced || stage < 1 || firedRef.current || !board.champion) return;
    const at = T_PODIUM + (podium.length - 1) * ROW_STEP + 260;
    const id = setTimeout(() => {
      firedRef.current = true;
      fireConfetti([accent, GOLD, "#ffffff", GOLD_DEEP]);
    }, Math.max(0, at - T_PODIUM));
    return () => clearTimeout(id);
  }, [stage, reduced, board.champion, podium.length, accent]);

  // Depth layers: the plaque sits nearest the viewer and swings hardest, the
  // outer columns next, the middle column least — the same cue a camera gives.
  const p3 = usePointer3D();
  const plaqueRotY = useTransform(p3.x, [-1, 1], [13, -13]);
  const plaqueRotX = useTransform(p3.y, [-1, 1], [-9, 9]);
  const plaqueX = useTransform(p3.x, [-1, 1], [-16, 16]);
  const nearX = useTransform(p3.x, [-1, 1], [-13, 13]);
  const nearY = useTransform(p3.y, [-1, 1], [-9, 9]);
  const farX = useTransform(p3.x, [-1, 1], [-6, 6]);
  const farY = useTransform(p3.y, [-1, 1], [-4, 4]);
  const spotX = useTransform(p3.x, [-1, 1], [-430, 430]);
  const spotY = useTransform(p3.y, [-1, 1], [-300, 300]);

  const bg = useMemo(
    () =>
      [
        `radial-gradient(1200px 900px at 50% -10%, color-mix(in srgb, ${accent} 46%, transparent), transparent 62%)`,
        `radial-gradient(900px 700px at 8% 105%, color-mix(in srgb, ${GOLD} 22%, transparent), transparent 66%)`,
        `linear-gradient(178deg, #0a0912 0%, #06050b 55%, #030307 100%)`,
      ].join(", "),
    [accent],
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: bg,
        color: "#f1f7f0",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "14px 20px 18px",
        overflow: "hidden",
      }}
    >
      <ChampionsStyles />

      {/* A pool of light that trails the cursor. Moved by transform (not by
          repainting a gradient position), sits behind everything, never
          intercepts clicks. */}
      {reduced ? null : (
        <motion.div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 900,
            height: 720,
            marginLeft: -450,
            marginTop: -360,
            zIndex: 0,
            pointerEvents: "none",
            x: spotX,
            y: spotY,
            background: `radial-gradient(closest-side, color-mix(in srgb, ${GOLD} 15%, transparent), transparent 72%)`,
          }}
        />
      )}

      {/* back */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(0,0,0,0.35)",
            color: "rgba(255,255,255,0.8)",
            fontFamily: JB,
            fontSize: 10.5,
            letterSpacing: "0.08em",
            cursor: "pointer",
          }}
        >
          ← VER PARTIDAS ANTERIORES
        </button>
      </div>

      {/* golden plaque — the pointer tilt lives on an OUTER layer that is never
          swapped out, so it survives the entrance settling underneath it. */}
      <motion.div
        style={{
          flex: "none",
          display: "flex",
          justifyContent: "center",
          zIndex: 1,
          rotateX: plaqueRotX,
          rotateY: plaqueRotY,
          x: plaqueX,
          transformPerspective: 1100,
        }}
      >
      <Reveal
        settled={settled}
        initial={{ opacity: 0, y: -70, scale: 0.85, rotateX: -40 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.1 }}
        style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, transformPerspective: 1000 }}
      >
        <div className="bf-plaque" style={{ display: "flex", alignItems: "center", gap: 18, padding: "12px 34px", borderRadius: 16 }}>
          <span className="bf-trophy" style={{ fontSize: 40, lineHeight: 1 }}>🏆</span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={mono(9, "#5a4412", "0.3em")}>CAMPEÃO DO MUNDO 2026</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
              {flag ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${ASSET_BASE}/flags/${flag}.svg`} alt="" width={44} height={32} style={{ borderRadius: 5, objectFit: "cover", boxShadow: "0 2px 10px rgba(0,0,0,0.45)" }} />
              ) : null}
              <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 40, lineHeight: 1, color: "#3a2a06", letterSpacing: "-0.01em" }}>
                {winnerName.toUpperCase()}
              </span>
            </span>
          </div>
          <span className="bf-trophy" style={{ fontSize: 40, lineHeight: 1 }}>🏆</span>
        </div>

        {/* The human headline act, billed alongside the world champion — the sub
            who won the tournament is the thing this room actually cares about. */}
        {board.champion ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              padding: "9px 18px",
              borderRadius: 14,
              background: `linear-gradient(135deg, color-mix(in srgb, ${GOLD} 20%, transparent), rgba(255,255,255,0.03))`,
              border: `1px solid ${GOLD}`,
              boxShadow: `0 14px 40px -18px ${GOLD}`,
            }}
          >
            <span style={mono(8, GOLD, "0.24em")}>CAMPEÃO DOS SUBS</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 21, lineHeight: 1 }}>🥇</span>
              <span
                style={{
                  fontFamily: BRIC,
                  fontWeight: 800,
                  fontSize: 27,
                  lineHeight: 1.05,
                  ...nameStyle(board.champion.username, "#fff8e2"),
                }}
              >
                {board.champion.username}
              </span>
            </span>
            <span style={mono(8.5, "rgba(255,255,255,0.6)", "0.1em")}>
              {fmt(board.champion.wins)} pontos
            </span>
          </div>
        ) : null}
      </Reveal>
      </motion.div>

      {/* boards */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "1.35fr 1fr 1fr",
          gap: 12,
          zIndex: 1,
        }}
      >
        {/* ---- podium ---- */}
        <motion.div style={{ display: "flex", flexDirection: "column", minHeight: 0, x: nearX, y: nearY }}>
        <Panel title="🏅 TOP 10 · RANKING DOS SUBS" sub="classificação final do campeonato" accent={GOLD} delay={0} show settled={settled} style={{ flex: 1 }}>
          {board.bot ? (
            <Reveal
              settled={settled}
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              style={{
                flex: "none",
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "7px 11px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: "1px dashed rgba(255,255,255,0.22)",
                marginBottom: 3,
              }}
            >
              <span style={mono(8, "rgba(255,255,255,0.5)", "0.12em")}>A MARCA DA IA</span>
              <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontWeight: 800, fontSize: 13, ...nameStyle(board.bot.username, "#fff") }}>
                {board.bot.username}
              </span>
              <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 15, color: "rgba(255,255,255,0.75)" }}>
                {fmt(board.bot.wins)}
              </span>
              <span style={mono(8, "rgba(255,255,255,0.4)")}>fora do pódio</span>
            </Reveal>
          ) : null}

          {podium.map((r, i) => (
            <Row key={r.username} delay={rowDelay(i)} show={stage >= 1} settled={settled} champion={i === 0}>
              <PodiumRow rank={i + 1} row={r} accent={accent} />
            </Row>
          ))}
          {podium.length === 0 ? <Empty>Sem palpites avaliados.</Empty> : null}
        </Panel>
        </motion.div>

        {/* ---- half points + best accuracy ---- */}
        <motion.div style={{ display: "grid", gridTemplateRows: "1.55fr 1fr", gap: 12, minHeight: 0, x: farX, y: farY }}>
        <Panel
          title="🎯 RANKING 0,5"
          sub="meio ponto para cada time com os gols exatos"
          accent="#7ee0a8"
          delay={0}
          show={stage >= 2}
          settled={settled}
        >
          {half.slice(0, 10).map((r, i) => (
            <Row key={r.username} delay={stage >= 2 ? i * 0.09 : 0} show={stage >= 2} settled={settled}>
              <ScoreRow
                rank={i + 1}
                name={r.username}
                value={fmt(r.points)}
                meta={`${r.exact} exatos · ${r.halves} meios`}
                accent="#7ee0a8"
              />
            </Row>
          ))}
          {half.length === 0 ? <Empty>Sem palpites avaliados.</Empty> : null}
        </Panel>

        <Panel
          title="🎯 TOP 5 · MAIOR APROVEITAMENTO"
          sub={`quem mais cravou o placar — mín. ${minBest} palpites`}
          accent="#c8ff2d"
          delay={0}
          show={stage >= 3}
          settled={settled}
        >
          {best.map((r, i) => (
            <Row key={r.username} delay={stage >= 3 ? 0.15 + i * 0.1 : 0} show={stage >= 3} settled={settled}>
              <ScoreRow
                rank={i + 1}
                name={r.username}
                value={pct(r.pct)}
                meta={`${r.hits} de ${r.palpites}`}
                accent="#c8ff2d"
              />
            </Row>
          ))}
          {best.length === 0 ? <Empty>Ninguém com palpites suficientes.</Empty> : null}
        </Panel>
        </motion.div>

        {/* ---- volume + worst accuracy ---- */}
        <motion.div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 12, minHeight: 0, x: nearX, y: nearY }}>
          <Panel title="🔥 TOP 5 · MAIS PALPITARAM" sub="quem mais apareceu no campeonato" accent="#ffa24d" delay={0} show={stage >= 3} settled={settled}>
            {volume.map((r, i) => (
              <Row key={r.username} delay={stage >= 3 ? i * 0.1 : 0} show={stage >= 3} settled={settled}>
                <ScoreRow rank={i + 1} name={r.username} value={`${r.palpites}`} meta="palpites" accent="#ffa24d" />
              </Row>
            ))}
            {volume.length === 0 ? <Empty>Sem palpites.</Empty> : null}
          </Panel>

          <Panel
            title="💀 TOP 5 · PIOR APROVEITAMENTO"
            sub={`palpitou muito e errou mais — mín. ${minPalpites} palpites`}
            accent="#ff7a7a"
            delay={0}
            show={stage >= 3}
            settled={settled}
          >
            {accuracy.map((r, i) => (
              <Row key={r.username} delay={stage >= 3 ? 0.25 + i * 0.1 : 0} show={stage >= 3} settled={settled}>
                <ScoreRow
                  rank={i + 1}
                  name={r.username}
                  value={pct(r.pct)}
                  meta={`${r.hits} de ${r.palpites}`}
                  accent="#ff7a7a"
                />
              </Row>
            ))}
            {accuracy.length === 0 ? <Empty>Ninguém com palpites suficientes.</Empty> : null}
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <span style={{ fontFamily: BRIC, fontSize: 12.5, color: "rgba(255,255,255,0.45)" }}>{children}</span>;
}

function PodiumRow({ rank, row, accent }: { rank: number; row: SubRank; accent: string }) {
  const champ = rank === 1;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: champ ? "12px 14px" : "8px 12px",
        borderRadius: 12,
        background: champ
          ? `linear-gradient(100deg, ${GOLD}3a, ${accent}22 60%, transparent)`
          : rank <= 3
            ? "rgba(255,255,255,0.05)"
            : "rgba(255,255,255,0.025)",
        border: champ ? `1px solid ${GOLD}` : "1px solid rgba(255,255,255,0.07)",
        boxShadow: champ ? `0 12px 40px -14px ${GOLD}` : "none",
      }}
    >
      <span
        style={{
          flex: "none",
          width: champ ? 30 : 22,
          textAlign: "center",
          fontFamily: SAIRA,
          fontWeight: 800,
          fontSize: champ ? 24 : 14,
          color: champ ? GOLD : rank <= 3 ? "#e6cf95" : "rgba(255,255,255,0.42)",
        }}
      >
        {medal ?? rank}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: BRIC,
          fontWeight: champ ? 800 : 700,
          fontSize: champ ? 23 : 15,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          ...nameStyle(row.username, champ ? "#fff8e2" : "#e9ece8"),
        }}
      >
        {row.username}
      </span>
      {champ ? <span style={{ ...mono(8, "#0f1004", "0.1em"), background: GOLD, padding: "3px 7px", borderRadius: 5, fontWeight: 800 }}>CAMPEÃO</span> : null}
      <span style={{ flex: "none", display: "inline-flex", alignItems: "baseline", gap: 4, fontFamily: SAIRA, fontWeight: 800, fontSize: champ ? 24 : 15 }}>
        <span style={{ color: champ ? GOLD : "#c8ff2d" }}>{fmt(row.wins)}</span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: champ ? 15 : 12 }}>–{row.losses}</span>
      </span>
      {row.penWins + row.penLosses > 0 ? (
        <span style={mono(8, "rgba(255,255,255,0.45)")}>p {row.penWins}–{row.penLosses}</span>
      ) : null}
    </div>
  );
}

function ScoreRow({
  rank,
  name,
  value,
  meta,
  accent,
}: {
  rank: number;
  name: string;
  value: string;
  meta: string;
  accent: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 10, background: rank === 1 ? `${accent}1c` : "rgba(255,255,255,0.025)", border: rank === 1 ? `1px solid ${accent}55` : "1px solid rgba(255,255,255,0.06)" }}>
      <span style={{ flex: "none", width: 16, textAlign: "center", fontFamily: JB, fontSize: 10, color: rank === 1 ? accent : "rgba(255,255,255,0.4)" }}>{rank}</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...nameStyle(name, "#e9ece8") }}>{name}</span>
      <span style={mono(8, "rgba(255,255,255,0.42)", "0.05em")}>{meta}</span>
      <span style={{ flex: "none", fontFamily: SAIRA, fontWeight: 800, fontSize: 15, color: accent }}>{value}</span>
    </div>
  );
}

/** Idle loop + plaque shine. Injected once; transform/opacity only. */
let injected = false;
function ChampionsStyles() {
  if (typeof document !== "undefined" && !injected) {
    const el = document.createElement("style");
    el.dataset.champions = "1";
    el.textContent = `
@keyframes bfPlaqueShine { 0% { background-position: -220% 0 } 100% { background-position: 220% 0 } }
@keyframes bfTrophyBob { 0%,100% { transform: translateY(0) rotate(-6deg) } 50% { transform: translateY(-6px) rotate(6deg) } }
/* Pulses BRIGHTNESS, not opacity, and that is load-bearing: a running CSS
   animation outranks an inline style, so an opacity keyframe here would override
   the opacity:0 framer-motion holds the champion at during the reveal — the row
   would sit there fully lit while the other nine were still hidden, spoiling the
   one moment the whole screen is built around. Nothing else animates filter. */
@keyframes bfChampGlow { 0%,100% { filter: brightness(1) } 50% { filter: brightness(1.14) } }
.bf-plaque {
  background-image: linear-gradient(100deg, #b98a22 0%, #ffe9a8 18%, #ffd76a 32%, #b98a22 52%, #ffe9a8 72%, #d9a83a 100%);
  background-size: 220% 100%;
  animation: bfPlaqueShine 7s linear infinite;
  border: 2px solid #fff0c0;
  box-shadow: 0 20px 60px -18px rgba(255,199,89,.75), inset 0 2px 0 rgba(255,255,255,.55), inset 0 -3px 8px rgba(0,0,0,.28);
}
.bf-trophy { animation: bfTrophyBob 3.4s ease-in-out infinite; display: inline-block }
.bf-champ-row { animation: bfChampGlow 2.6s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) {
  .bf-plaque, .bf-trophy, .bf-champ-row { animation: none !important }
}
`;
    document.head.appendChild(el);
    injected = true;
  }
  return null;
}
