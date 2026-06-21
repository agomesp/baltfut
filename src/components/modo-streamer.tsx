"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tv } from "lucide-react";
import { MONO } from "@/components/primitives";

const RELOAD_SECS = 30; // background reload cadence (matches the scoreboard poll)
const IDLE_STOP_MS = 2 * 60 * 60 * 1000; // stop auto-reload after 2h hidden
const SCROLL_KEY = "baltfut_scroll";
const ACTIVE_KEY = "baltfut_lastactive";
const SCROLL_FRESH_MS = 120_000; // only restore a scroll position from a recent reload

function getLastActive(): number {
  try {
    return Number(sessionStorage.getItem(ACTIVE_KEY)) || Date.now();
  } catch {
    return Date.now();
  }
}
function bumpActive() {
  try {
    sessionStorage.setItem(ACTIVE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}
function saveScroll() {
  try {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ y: window.scrollY, t: Date.now() }));
  } catch {
    /* ignore */
  }
}

/**
 * Modo Streamer — keeps a backgrounded tab live, for free, for every visitor.
 *
 * The problem: when the tab is hidden (OBS capture, another window on top,
 * minimized), browsers throttle our in-page polls to ~once/min and can discard
 * the tab outright (the screen goes grey). The fix: while hidden, reload the page
 * on a timer via a native <meta http-equiv="refresh"> — a browser-scheduled
 * navigation that keeps firing when JS timers are throttled, and a tab that keeps
 * navigating is never put to sleep.
 *
 * While the tab is VISIBLE we do nothing — the normal in-page polling already
 * updates the scores smoothly, with no reload flash and no interrupting someone
 * mid-palpite. Scroll position is preserved across reloads, and after 2h with the
 * tab hidden we stop reloading (so abandoned tabs don't hammer the APIs forever);
 * it resumes the moment the tab is looked at again.
 *
 * On by default; the floating button toggles it off for the current page load.
 */
export function ModoStreamer() {
  const [on, setOn] = useState(true);
  const onRef = useRef(true);
  const metaRef = useRef<HTMLMetaElement | null>(null);

  const removeMeta = useCallback(() => {
    metaRef.current?.remove();
    metaRef.current = null;
  }, []);

  const installMeta = useCallback(() => {
    removeMeta();
    const m = document.createElement("meta");
    m.httpEquiv = "refresh";
    m.content = String(RELOAD_SECS); // empty URL → reloads current URL
    document.head.appendChild(m);
    metaRef.current = m;
  }, [removeMeta]);

  // Decide whether a background reload should be scheduled right now.
  const apply = useCallback(() => {
    removeMeta();
    if (!onRef.current) return; // user turned it off
    if (!document.hidden) return; // visible → in-page polls handle updates
    if (Date.now() - getLastActive() > IDLE_STOP_MS) return; // 2h idle → hard stop
    installMeta();
  }, [removeMeta, installMeta]);

  // Listeners + scroll restore (mount once).
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    // Restore a recent scroll position (i.e. right after an auto-reload), retrying
    // while the async data renders and grows the page.
    try {
      const raw = sessionStorage.getItem(SCROLL_KEY);
      if (raw) {
        const { y, t } = JSON.parse(raw);
        if (typeof y === "number" && y > 0 && Date.now() - t < SCROLL_FRESH_MS) {
          let tries = 0;
          const restore = () => {
            window.scrollTo(0, y);
            if (++tries < 60 && Math.abs(window.scrollY - y) > 2) requestAnimationFrame(restore);
          };
          requestAnimationFrame(restore);
          window.setTimeout(() => window.scrollTo(0, y), 500);
          window.setTimeout(() => window.scrollTo(0, y), 1200);
        }
      }
    } catch {
      /* ignore */
    }

    let scrollT: number | undefined;
    const onScroll = () => {
      window.clearTimeout(scrollT);
      scrollT = window.setTimeout(saveScroll, 250);
    };
    const onVis = () => {
      bumpActive(); // mark the moment of entering/leaving the foreground
      if (!document.hidden) saveScroll();
      apply();
    };

    if (!document.hidden) bumpActive();
    apply();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", bumpActive);
    window.addEventListener("keydown", bumpActive);
    window.addEventListener("pagehide", saveScroll);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(scrollT);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", bumpActive);
      window.removeEventListener("keydown", bumpActive);
      window.removeEventListener("pagehide", saveScroll);
      document.removeEventListener("visibilitychange", onVis);
      removeMeta();
    };
  }, [apply, removeMeta]);

  // React to the toggle.
  useEffect(() => {
    onRef.current = on;
    apply();
  }, [on, apply]);

  return (
    <button
      onClick={() => setOn((v) => !v)}
      title={
        on
          ? "Atualiza sozinho quando a aba fica em segundo plano (ex.: captura no OBS). Toque para desligar."
          : "Atualização automática desligada. Toque para ligar."
      }
      style={{
        position: "fixed",
        bottom: 14,
        right: 14,
        zIndex: 60,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "10px 14px",
        borderRadius: 999,
        cursor: "pointer",
        boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
        background: on ? "var(--signal)" : "var(--surface)",
        color: on ? "var(--signal-ink)" : "var(--ink-2)",
        border: `1px solid ${on ? "transparent" : "var(--line-2)"}`,
      }}
    >
      <Tv size={15} />
      Modo Streamer
      <span
        style={{
          fontSize: 10,
          padding: "2px 7px",
          borderRadius: 999,
          background: on ? "rgba(0,0,0,0.2)" : "transparent",
          border: on ? "none" : "1px solid var(--line-2)",
          color: on ? "var(--signal-ink)" : "var(--ink-3)",
        }}
      >
        {on ? "Ligado" : "Desligado"}
      </span>
    </button>
  );
}
