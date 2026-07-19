"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { pointerBias } from "@/lib/champions/pointer";
import { JB, SAIRA } from "@/components/live/bf-ui";

/**
 * Motion primitives for the final.
 *
 * Hard rule for everything in here: it animates something ALREADY on screen.
 * No primitive adds text, adds a box, or changes a measured size — the final's
 * views are laid out to fit one screen with no scrolling, and a stray pixel of
 * growth breaks that. Effects are keyed off VALUE CHANGES (a goal, a new
 * palpite, a rank swap) rather than running on a loop, because the audience
 * that matters is a stream and idle repaints cost the broadcaster frames.
 *
 * `prefers-reduced-motion` — and a hidden document, see {@link useMotionOk} —
 * collapses every one of these to a plain render.
 */

// ---------------------------------------------------------------------------
// When it is safe to animate at all
// ---------------------------------------------------------------------------

/**
 * True only when motion can actually finish.
 *
 * This is not a nicety, it is a correctness gate. In an occluded/backgrounded tab
 * the browser stops firing rAF (measured: 0 fps), which strands every in-flight
 * animation exactly where it was. For an entrance that means invisible content;
 * for `AnimatePresence` it means the OUTGOING copy never leaves, so a rolling
 * clock stacks ghost digits and "28%" renders as an unreadable smear.
 *
 * The tab that matters most here is a streamer's, parked behind OBS — precisely
 * the state that breaks. So when the document is hidden, every primitive below
 * renders as plain static markup, byte-identical to no effects at all. Fun when
 * someone is watching; correct when the machine is only broadcasting.
 */
function useMotionOk(): boolean {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const sync = () => setVisible(!document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return !reduced && visible;
}

// ---------------------------------------------------------------------------
// Value-change detection
// ---------------------------------------------------------------------------

/** Fires a token that changes whenever `value` does — drive a flash off it. */
export function useChangeToken<T>(value: T): number {
  const [token, setToken] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setToken((t) => t + 1);
    }
  }, [value]);
  return token;
}

/** How `value` moved since last render: 1 up, -1 down, 0 unchanged. */
export function useDelta(value: number): number {
  const [dir, setDir] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      const d = value > prev.current ? 1 : -1;
      prev.current = value;
      setDir(d);
      const id = setTimeout(() => setDir(0), 1400);
      return () => clearTimeout(id);
    }
  }, [value]);
  return dir;
}

// ---------------------------------------------------------------------------
// Rolling numbers
// ---------------------------------------------------------------------------

/**
 * A number whose digits roll like a split-flap when they change — the countdown
 * seconds, a scoreline, a stepper.
 *
 * Only the characters that actually changed move; the rest sit still, so a
 * ticking clock animates one digit a second rather than the whole field. Each
 * glyph keeps its natural advance width in normal flow and the outgoing copy
 * leaves via `popLayout` (out of flow), so the rendered width is byte-identical
 * to printing the string.
 */
export function RollingNumber({
  value,
  style,
  height,
}: {
  value: string | number;
  style?: CSSProperties;
  /** Travel distance for the roll, as a fraction of line height. */
  height?: number;
}) {
  const ok = useMotionOk();
  const text = String(value);
  // Static text is the fallback, so a stalled frame can never smear the number.
  if (!ok) return <span style={style}>{text}</span>;
  const d = height ?? 0.9;
  return (
    <span style={{ ...style, display: "inline-flex", alignItems: "baseline" }}>
      {text.split("").map((ch, i) => (
        <span key={i} style={{ display: "inline-block", position: "relative", overflow: "hidden" }}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={ch}
              initial={{ y: `-${d * 100}%`, opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              exit={{ y: `${d * 100}%`, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.6 }}
              style={{ display: "inline-block", whiteSpace: "pre" }}
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Emphasis
// ---------------------------------------------------------------------------

/**
 * Slams on change: a quick overshoot then settle. For a scoreline — the one
 * moment in the match everyone is staring at the same three characters.
 */
export function SlamOnChange({
  trigger,
  children,
  scale = 1.35,
  style,
}: {
  trigger: unknown;
  children: ReactNode;
  scale?: number;
  style?: CSSProperties;
}) {
  const ok = useMotionOk();
  if (!ok) return <span style={style}>{children}</span>;
  return (
    <motion.span
      key={String(trigger)}
      initial={{ scale }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 14, mass: 0.7 }}
      style={{ display: "inline-block", transformOrigin: "center", ...style }}
    >
      {children}
    </motion.span>
  );
}

/**
 * A one-shot wash of colour across a row when its value climbs — how a sub
 * finds out they just gained. Background-only, so nothing reflows.
 */
export function FlashOnGain({
  value,
  colour,
  children,
  style,
}: {
  value: number;
  colour: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const ok = useMotionOk();
  const dir = useDelta(value);
  if (!ok) return <div style={style}>{children}</div>;
  return (
    <motion.div
      animate={
        dir > 0
          ? { backgroundColor: [`${colour}00`, `${colour}55`, `${colour}00`] }
          : { backgroundColor: `${colour}00` }
      }
      transition={{ duration: 1.3, times: [0, 0.15, 1], ease: "easeOut" }}
      style={{ borderRadius: 8, ...style }}
    >
      {children}
    </motion.div>
  );
}

/** Drifts forever on the spot. Transform-only, so it stays on the compositor. */
export function IdleFloat({
  children,
  amount = 3,
  seconds = 4.5,
  delay = 0,
  style,
}: {
  children: ReactNode;
  amount?: number;
  seconds?: number;
  delay?: number;
  style?: CSSProperties;
}) {
  const ok = useMotionOk();
  if (!ok) return <span style={style}>{children}</span>;
  return (
    <motion.span
      animate={{ y: [0, -amount, 0] }}
      transition={{ duration: seconds, delay, repeat: Infinity, ease: "easeInOut" }}
      style={{ display: "inline-block", willChange: "transform", ...style }}
    >
      {children}
    </motion.span>
  );
}

/**
 * A band of light that sweeps across whatever it wraps. Rendered as an overlay
 * moved by TRANSFORM — a background-position sweep would repaint the element
 * every frame, which is what already made this app's hero expensive.
 */
export function Sheen({
  children,
  seconds = 3.6,
  tint = "rgba(255,255,255,0.42)",
  radius = 12,
  style,
}: {
  children: ReactNode;
  seconds?: number;
  tint?: string;
  radius?: number;
  style?: CSSProperties;
}) {
  const ok = useMotionOk();
  return (
    <span style={{ position: "relative", display: "block", overflow: "hidden", borderRadius: radius, ...style }}>
      {children}
      {!ok ? null : (
        <motion.span
          aria-hidden
          initial={{ x: "-130%" }}
          animate={{ x: "130%" }}
          transition={{ duration: seconds, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" }}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `linear-gradient(105deg, transparent 38%, ${tint} 50%, transparent 62%)`,
            willChange: "transform",
          }}
        />
      )}
    </span>
  );
}

/**
 * A halo that swells and fades behind whatever it wraps.
 *
 * The glow is its own layer animating opacity + scale, NOT an animated
 * `box-shadow` — a pulsing shadow repaints the element every frame, which is the
 * pattern that already made this app's hero expensive. This one stays on the
 * compositor. It sits behind the content and never takes pointer events, so it
 * can be dropped around anything without touching layout.
 */
export function GlowPulse({
  colour,
  children,
  size = 1.5,
  seconds = 3.2,
  delay = 0,
  strength = 0.5,
  style,
}: {
  colour: string;
  children: ReactNode;
  /** Halo diameter as a multiple of the content box. */
  size?: number;
  seconds?: number;
  delay?: number;
  strength?: number;
  style?: CSSProperties;
}) {
  const ok = useMotionOk();
  const pct = `${Math.round((size - 1) * 50)}%`;
  return (
    <span style={{ position: "relative", display: "inline-flex", ...style }}>
      {ok ? (
        <motion.span
          aria-hidden
          initial={{ opacity: strength * 0.45, scale: 0.92 }}
          animate={{ opacity: [strength * 0.35, strength, strength * 0.35], scale: [0.92, 1.06, 0.92] }}
          transition={{ duration: seconds, delay, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            top: `-${pct}`,
            bottom: `-${pct}`,
            left: `-${pct}`,
            right: `-${pct}`,
            borderRadius: "50%",
            background: `radial-gradient(closest-side, ${colour}, transparent 72%)`,
            pointerEvents: "none",
            zIndex: 0,
            willChange: "transform, opacity",
          }}
        />
      ) : null}
      <span style={{ position: "relative", zIndex: 1, display: "inline-flex" }}>{children}</span>
    </span>
  );
}

/** Lifts toward the viewer on hover. Spread onto any motion element. */
export const hoverLift = {
  whileHover: { y: -3, scale: 1.014 },
  transition: { type: "spring" as const, stiffness: 420, damping: 26 },
};

/**
 * A ring that punches outward from the middle of its parent when `trigger`
 * changes — the visual thump of a goal. Needs a positioned parent; renders
 * nothing until the first change, so it can't flash on mount.
 */
export function Shockwave({ trigger, colour, size = 150 }: { trigger: unknown; colour: string; size?: number }) {
  const ok = useMotionOk();
  const token = useChangeToken(trigger);
  if (!ok || token === 0) return null;
  return (
    <motion.span
      key={token}
      aria-hidden
      initial={{ opacity: 0.8, scale: 0.15 }}
      animate={{ opacity: 0, scale: 1 }}
      transition={{ duration: 0.95, ease: "easeOut" }}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: "50%",
        border: `2px solid ${colour}`,
        boxShadow: `0 0 26px ${colour}`,
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * Rows arriving in a list — springs up with a stagger by index. The delay is
 * capped so a long feed doesn't leave the last row waiting seconds to appear.
 */
export function PopIn({ index = 0, children, style }: { index?: number; children: ReactNode; style?: CSSProperties }) {
  const ok = useMotionOk();
  if (!ok) return <div style={style}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(index, 8) * 0.05, type: "spring", stiffness: 340, damping: 26 }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/** Presses in when tapped. Pure feedback on controls that already exist. */
export const tapProps = {
  whileTap: { scale: 0.9 },
  whileHover: { scale: 1.06 },
  transition: { type: "spring" as const, stiffness: 600, damping: 20 },
};

/** Swells and settles, forever — a card that looks like it's alive rather than
 *  printed. Transform/opacity only. */
export function Breathe({
  children,
  scale = 1.012,
  seconds = 5,
  delay = 0,
  style,
}: {
  children: ReactNode;
  scale?: number;
  seconds?: number;
  delay?: number;
  style?: CSSProperties;
}) {
  const ok = useMotionOk();
  if (!ok) return <div style={style}>{children}</div>;
  return (
    <motion.div
      animate={{ scale: [1, scale, 1] }}
      transition={{ duration: seconds, delay, repeat: Infinity, ease: "easeInOut" }}
      style={{ willChange: "transform", ...style }}
    >
      {children}
    </motion.div>
  );
}

/**
 * "Sua % de acerto" — the viewer's own hit rate.
 *
 * Renders nothing without a row, and callers pass null whenever the visitor has
 * no claimed nickname, so someone who has never palpitado is never shown a
 * hollow 0%.
 */
export function AccuracyBadge({
  row,
  accent,
  align = "center",
  style,
}: {
  row: { hits: number; palpites: number; pct: number } | null;
  accent: string;
  align?: "center" | "start";
  style?: CSSProperties;
}) {
  if (!row) return null;
  return (
    <div
      title={`${row.hits} placares exatos em ${row.palpites} palpites`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        gap: 1,
        padding: "5px 11px",
        borderRadius: 10,
        border: `1px solid ${accent}`,
        background: `color-mix(in srgb, ${accent} 14%, transparent)`,
        flex: "none",
        lineHeight: 1.05,
        ...style,
      }}
    >
      <span style={{ fontFamily: JB, fontSize: 7.5, letterSpacing: "0.14em", color: "rgba(255,255,255,0.62)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
        sua % de acerto
      </span>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 19, color: accent }}>
          {Math.round(row.pct * 100)}%
        </span>
        <span style={{ fontFamily: JB, fontSize: 8, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>
          {row.hits}/{row.palpites}
        </span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pointer-driven 3D
// ---------------------------------------------------------------------------

/**
 * Pointer position → a springy -1..1 bias per axis, for leaning the page away
 * from the cursor.
 *
 * Motion values are written straight to the DOM, so tracking the pointer never
 * re-renders React — otherwise every mousemove would re-render the whole
 * dashboard. Returns nulls when motion isn't safe, so callers can skip wiring.
 */
export function usePointer3D(): { x: MotionValue<number>; y: MotionValue<number>; ok: boolean } {
  const ok = useMotionOk();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  useEffect(() => {
    if (!ok) {
      rawX.set(0);
      rawY.set(0);
      return;
    }
    const onMove = (e: PointerEvent) => {
      const b = pointerBias(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
      rawX.set(b.x);
      rawY.set(b.y);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [ok, rawX, rawY]);
  const cfg = { stiffness: 55, damping: 20, mass: 0.7 };
  return { x: useSpring(rawX, cfg), y: useSpring(rawY, cfg), ok };
}

/**
 * Leans its children away from the cursor. `depth` scales the whole effect, so
 * nearer layers can be given a bigger number and the page reads as having
 * actual depth rather than everything sliding together.
 *
 * Transform-only and layout-neutral: nothing here changes a measured box, so a
 * tilted panel can't push the one-screen dashboard into scrolling.
 */
export function Parallax({
  p3,
  depth = 1,
  tilt = 0,
  children,
  style,
}: {
  p3: { x: MotionValue<number>; y: MotionValue<number>; ok: boolean };
  depth?: number;
  /** Degrees of 3D rotation at full deflection. 0 = drift only. */
  tilt?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const dx = useTransform(p3.x, [-1, 1], [-7 * depth, 7 * depth]);
  const dy = useTransform(p3.y, [-1, 1], [-5 * depth, 5 * depth]);
  const ry = useTransform(p3.x, [-1, 1], [tilt, -tilt]);
  const rx = useTransform(p3.y, [-1, 1], [-tilt, tilt]);
  if (!p3.ok) return <div style={style}>{children}</div>;
  return (
    <motion.div
      style={{
        x: dx,
        y: dy,
        rotateX: tilt ? rx : undefined,
        rotateY: tilt ? ry : undefined,
        transformPerspective: tilt ? 1200 : undefined,
        willChange: "transform",
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// The stomp
// ---------------------------------------------------------------------------

/** "We Will Rock You" is 81 BPM in 4/4 — one bar is stomp, stomp, clap, rest. */
const BPM = 81;
export const BAR_SECONDS = (60 / BPM) * 4;
/** Beat positions within the bar, as a fraction: stomps on 1 and 2, clap on 3. */
export const STOMP_1 = 0;
export const STOMP_2 = 0.25;
export const CLAP = 0.5;

/**
 * Turn hit positions into a keyframe track that punches instead of pulsing: the
 * value sits low, jumps on the beat (over ~35ms, which reads as percussive), then
 * decays. Ramping into the peak instead would feel like a sine wave, not a stomp.
 */
export function beatTrack(hits: number[], base: number, peak: number) {
  const times: number[] = [];
  const values: number[] = [];
  for (const h of hits) {
    if (h > 0.012) {
      times.push(h - 0.012);
      values.push(base);
    }
    times.push(h);
    values.push(peak);
    times.push(Math.min(0.999, h + 0.15));
    values.push(base);
  }
  if (times[0] > 0) {
    times.unshift(0);
    values.unshift(base);
  }
  times.push(1);
  values.push(base);
  return { times, values };
}

/**
 * The crowd, rendered as light: a slab of each team's colour on its own side of
 * the screen, punching in the We Will Rock You rhythm — left on the first stomp,
 * right on the second, both together on the clap, then a bar's rest.
 *
 * Cost is two elements animating OPACITY only, which the compositor handles
 * without repainting anything, and the whole thing unmounts when the tab is
 * hidden — so the streamer's occluded window pays nothing for it.
 */
export function StompBeat({
  homeAccent,
  awayAccent,
  intensity = 1,
}: {
  homeAccent: string;
  awayAccent: string;
  /** 0 disables; 1 is the tuned default. */
  intensity?: number;
}) {
  const ok = useMotionOk();
  if (!ok || intensity <= 0) return null;
  const base = 0.05 * intensity;
  const peak = 0.42 * intensity;
  const left = beatTrack([STOMP_1, CLAP], base, peak);
  const right = beatTrack([STOMP_2, CLAP], base, peak);
  const side = (accent: string, from: "left" | "right", track: { times: number[]; values: number[] }) => (
    <motion.div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [from]: 0,
        width: "30vw",
        background: `linear-gradient(${from === "left" ? 90 : 270}deg, ${accent} 0%, transparent 72%)`,
        willChange: "opacity",
      }}
      // Explicit resting opacity, so a frame that never arrives leaves a faint
      // wash rather than a full-strength slab of colour across the screen.
      initial={{ opacity: base }}
      animate={{ opacity: track.values }}
      transition={{ duration: BAR_SECONDS, times: track.times, repeat: Infinity, ease: "linear" }}
    />
  );
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      {side(homeAccent, "left", left)}
      {side(awayAccent, "right", right)}
      <Embers accent={homeAccent} from="left" hits={[STOMP_1, CLAP]} intensity={intensity} />
      <Embers accent={awayAccent} from="right" hits={[STOMP_2, CLAP]} intensity={intensity} />
    </div>
  );
}

/** Particles per side. Small enough to stay cheap, enough to read as a shower. */
const EMBERS_PER_SIDE = 9;

/**
 * Embers thrown off the wall of light on every hit — each side in its own team
 * colour, kicked up and inward as if the stomp knocked them loose.
 *
 * Nothing is spawned at runtime. Spawning on the beat would mean a timer, a state
 * update and a React render every ~740ms, forever; instead a fixed set of
 * particles each loops over one bar with its burst window positioned on the beat
 * it belongs to. The DOM never changes after mount — only transforms and opacity,
 * which the compositor owns.
 *
 * Placement is derived from the index rather than random, so the server and the
 * client agree and there's no hydration mismatch.
 */
function Embers({
  accent,
  from,
  hits,
  intensity,
}: {
  accent: string;
  from: "left" | "right";
  hits: number[];
  intensity: number;
}) {
  return (
    <>
      {Array.from({ length: EMBERS_PER_SIDE }, (_, i) => {
        const hit = hits[i % hits.length];
        // Deterministic spread: golden-ratio stepping keeps successive particles
        // far apart vertically instead of banding.
        const seed = ((i * 0.618034) % 1 + 1) % 1;
        const top = 12 + seed * 76;
        const size = 3 + ((i * 7) % 5);
        const rise = 90 + ((i * 37) % 120);
        const drift = (28 + ((i * 23) % 62)) * (from === "left" ? 1 : -1);
        const startX = 2 + ((i * 13) % 16);
        // A hair of jitter so the nine don't leave in perfect lockstep.
        const at = Math.min(0.94, hit + ((i % 3) * 0.012));
        const gone = Math.min(0.999, at + 0.3);
        return (
          <motion.span
            key={`${from}-${i}`}
            style={{
              position: "absolute",
              top: `${top}%`,
              [from]: `${startX}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: accent,
              boxShadow: `0 0 ${size * 2.5}px ${accent}`,
              willChange: "transform, opacity",
            }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0, 0.85 * intensity, 0, 0],
              y: [0, 0, -rise * 0.15, -rise, -rise],
              x: [0, 0, drift * 0.2, drift, drift],
              scale: [0.4, 0.4, 1, 0.25, 0.25],
            }}
            transition={{
              duration: BAR_SECONDS,
              times: [0, Math.max(0, at - 0.01), at, gone, 1],
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        );
      })}
    </>
  );
}
