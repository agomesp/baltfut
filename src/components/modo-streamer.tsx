"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tv } from "lucide-react";
import { MONO } from "@/components/primitives";

const RELOAD_SECS = 30; // reload cadence while Modo Streamer is on
const IDLE_OFF_MS = 2 * 60 * 60 * 1000; // auto-disable after 2h in the background
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
 * Modo Streamer — keeps the page fresh for a capture/background window.
 *
 * While ON it simply reloads the page every RELOAD_SECS, regardless of whether the
 * browser thinks the tab is visible — more reliable for OBS, where a captured
 * window in the background may not be reported as hidden, yet its timers get
 * throttled and the tab can be discarded (the screen goes grey/stale). Reloading
 * on a short cadence keeps the tab active so it is never throttled or discarded.
 *
 * Scroll position and the in-progress palpite are preserved across reloads. After
 * 2h with the browser window unfocused it auto-disables (so an abandoned tab stops
 * hitting the APIs); focusing the window resets that 2h counter. The floating
 * button toggles it for the current page load (a manual refresh returns to ON).
 */
export function ModoStreamer() {
  const [on, setOn] = useState(true);
  const onRef = useRef(true);
  const timerRef = useRef<number | undefined>(undefined);

  const clearReload = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  // Reschedule the reload. Always on while enabled — not gated on visibility.
  const apply = useCallback(() => {
    clearReload();
    if (!onRef.current) return;
    timerRef.current = window.setTimeout(() => {
      saveScroll();
      window.location.reload();
    }, RELOAD_SECS * 1000);
  }, [clearReload]);

  // Mount: scroll restore + listeners + initial schedule / auto-disable.
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
    const reset = () => bumpActive(); // focus / interaction → reset the 2h counter
    const onVis = () => {
      if (!document.hidden) {
        bumpActive();
        saveScroll();
      }
    };

    if (document.hasFocus()) bumpActive();

    // Auto-disable if the window has been unfocused past the limit; else schedule.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!document.hasFocus() && Date.now() - getLastActive() > IDLE_OFF_MS) {
      setOn(false);
    } else {
      apply();
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("focus", reset);
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    window.addEventListener("pagehide", saveScroll);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(scrollT);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("focus", reset);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
      window.removeEventListener("pagehide", saveScroll);
      document.removeEventListener("visibilitychange", onVis);
      clearReload();
    };
  }, [apply, clearReload]);

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
          ? `Recarrega a cada ${RELOAD_SECS}s para não congelar em segundo plano (ex.: OBS). Toque para desativar.`
          : "Atualização automática desativada. Toque para ativar."
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
        background: on ? "var(--signal)" : "var(--rank)",
        color: "var(--signal-ink)",
        border: "1px solid transparent",
      }}
    >
      {on ? (
        <span
          aria-hidden
          className="rec-blink"
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: "#e5484d",
            display: "inline-block",
            flex: "0 0 auto",
          }}
        />
      ) : (
        <Tv size={15} />
      )}
      Modo Streamer
      <span
        style={{
          fontSize: 10,
          padding: "2px 7px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.18)",
          color: "var(--signal-ink)",
        }}
      >
        {on ? "Ativado" : "Desativado"}
      </span>
    </button>
  );
}
