"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tv } from "lucide-react";
import { subscribeScoreboard } from "@/lib/scoreboard-source";
import { subscribeHeartbeat } from "@/lib/heartbeat";
import { setStreamerMode } from "@/lib/streamer-mode";
import { pickMatch } from "@/components/pip/resolve";
import { streamerClock } from "@/components/streamer-clock";

/**
 * Modo Streamer — PiP keep-alive. OFF by default; the user must turn it on.
 *
 * Clicking it ON opens a tiny, always-on-top Document Picture-in-Picture window
 * (the click is the user gesture browsers require — a PiP can't auto-open on
 * load) showing ONLY the live match clock, ticking every second. That window is
 * never occluded or throttled, so a streamer window-capturing the page sees the
 * clock moving and knows the capture isn't frozen. It's kept as small as the
 * browser allows so it barely covers the match. Closing the PiP turns the mode
 * off. Unsupported browsers (no Document PiP) just toggle the flag.
 *
 * Data flow: the seconds tick off the shared heartbeat worker, and the base
 * minute is refreshed by the shared scoreboard worker source — both escape the
 * hidden-tab timer throttle, so the clock stays correct even while occluded.
 */
const PIP_STYLE =
  "html,body{margin:0;height:100%}" +
  "body{background:#0b0b0c;color:#62cb84;display:flex;flex-direction:column;align-items:center;" +
  "justify-content:center;gap:4px;font-family:ui-monospace,Menlo,Consolas,monospace;overflow:hidden}" +
  ".clk{font-variant-numeric:tabular-nums;font-size:22px;font-weight:700;letter-spacing:.02em;white-space:nowrap;line-height:1}" +
  ".hint{font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:#6a6b66;white-space:nowrap;line-height:1}";

interface DocumentPiP {
  requestWindow: (opts: { width: number; height: number }) => Promise<Window>;
}

export function ModoStreamer() {
  const [on, setOn] = useState(false);
  const pipRef = useRef<Window | null>(null);
  const clkRef = useRef<HTMLElement | null>(null);
  const dataRef = useRef<{ clock: string | null; fetchedAt: number }>({ clock: null, fetchedAt: 0 });
  const stopWorkerRef = useRef<(() => void) | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Mirror on/off into the shared streamer flag so the update-banner can suppress
  // its force-reload while a broadcast is live (a reload would blank the capture).
  const applyOn = useCallback((v: boolean) => {
    setOn(v);
    setStreamerMode(v);
  }, []);

  // Repaint the PiP clock from the last-fetched minute + seconds elapsed since.
  const paint = useCallback(() => {
    const el = clkRef.current;
    if (!el) return;
    const elapsed = (Date.now() - dataRef.current.fetchedAt) / 1000;
    el.textContent = streamerClock(dataRef.current.clock, elapsed) || "—";
  }, []);

  const stop = useCallback(() => {
    stopWorkerRef.current?.();
    stopWorkerRef.current = null;
    unsubRef.current?.();
    unsubRef.current = null;
    clkRef.current = null;
    const p = pipRef.current;
    pipRef.current = null;
    if (p && !p.closed) {
      try {
        p.close();
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Start feeding the clock once the PiP element exists. The scoreboard worker
  // keeps the base minute fresh (full-rate even when hidden); the heartbeat
  // ticks the seconds in between.
  const startFeed = useCallback(() => {
    stopWorkerRef.current = subscribeScoreboard((matches) => {
      const m = pickMatch(matches, Date.now());
      dataRef.current = { clock: m && m.state === "in" ? m.displayClock : null, fetchedAt: Date.now() };
      paint();
    });
    unsubRef.current = subscribeHeartbeat(paint);
  }, [paint]);

  const toggle = useCallback(() => {
    if (on) {
      stop();
      applyOn(false);
      return;
    }
    const dpip = (window as unknown as { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture;
    if (!dpip) {
      // No Document PiP (e.g. Firefox/Safari): just flag it on; the keep-alive
      // video + worker still run. Nothing to open.
      applyOn(true);
      return;
    }
    // Must be called during this click's user activation. Request the smallest
    // window we can; the browser clamps up to its own minimum.
    dpip
      .requestWindow({ width: 130, height: 64 })
      .then((pip) => {
        pipRef.current = pip;
        const st = pip.document.createElement("style");
        st.textContent = PIP_STYLE;
        pip.document.head.appendChild(st);
        const el = pip.document.createElement("div");
        el.className = "clk";
        el.textContent = "—";
        pip.document.body.appendChild(el);
        clkRef.current = el;
        const hint = pip.document.createElement("div");
        hint.className = "hint";
        hint.textContent = "não feche";
        pip.document.body.appendChild(hint);
        pip.addEventListener("pagehide", () => {
          stop();
          applyOn(false);
        });
        startFeed();
        applyOn(true);
      })
      .catch(() => {
        applyOn(false);
      });
  }, [on, stop, startFeed, applyOn]);

  // Close the PiP if this ever unmounts.
  useEffect(() => () => stop(), [stop]);

  return (
    <button
      onClick={toggle}
      // OFF gets the pulsing-glow alert (a reminder to turn it on); ON is calm.
      className={on ? undefined : "bf-streamer-alert"}
      title={
        on
          ? "Mostrando o relógio do jogo numa janelinha (não feche). Toque para desligar."
          : "Abre uma janelinha minúscula com o relógio do jogo para confirmar que a captura está ao vivo."
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-jb)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "9px 13px",
        borderRadius: 8,
        cursor: "pointer",
        boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
        background: on ? "rgba(67,184,106,0.16)" : "rgba(255,77,77,0.22)",
        color: on ? "#bff0cf" : "#ffc9c9",
        border: `1px solid ${on ? "rgba(98,203,132,0.55)" : "rgba(255,77,77,0.7)"}`,
      }}
    >
      {on ? (
        <span
          aria-hidden
          className="rec-blink"
          style={{ width: 9, height: 9, borderRadius: 999, background: "#e5484d", display: "inline-block", flex: "0 0 auto" }}
        />
      ) : (
        <Tv size={15} />
      )}
      Modo Streamer
      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: on ? "#43b86a" : "#ff4d4d", color: on ? "#06160c" : "#2a0606" }}>
        {on ? "ATIVADO" : "DESATIVADO"}
      </span>
    </button>
  );
}
