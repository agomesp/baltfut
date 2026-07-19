"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

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

/** Presses in when tapped. Pure feedback on controls that already exist. */
export const tapProps = {
  whileTap: { scale: 0.9 },
  whileHover: { scale: 1.06 },
  transition: { type: "spring" as const, stiffness: 600, damping: 20 },
};
