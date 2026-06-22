"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tv } from "lucide-react";
import { MONO } from "@/components/primitives";
import { parseScoreboard, scoreboardUrl, DEFAULT_LEAGUE, FIFA_WORLD_DATE_RANGE } from "@/lib/espn";
import { startScoreboardWorker } from "@/lib/scoreboard-worker";
import { subscribeHeartbeat } from "@/lib/heartbeat";
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
 * minute is refreshed by a scoreboard Web Worker — both escape the hidden-tab
 * timer throttle, so the clock stays correct even while the capture is occluded.
 */
const POLL_MS = 20_000;

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
    stopWorkerRef.current = startScoreboardWorker(
      scoreboardUrl(DEFAULT_LEAGUE, FIFA_WORLD_DATE_RANGE),
      POLL_MS,
      (json) => {
        const m = pickMatch(parseScoreboard(json, DEFAULT_LEAGUE), Date.now());
        dataRef.current = { clock: m && m.state === "in" ? m.displayClock : null, fetchedAt: Date.now() };
        paint();
      },
    );
    unsubRef.current = subscribeHeartbeat(paint);
  }, [paint]);

  const toggle = useCallback(() => {
    if (on) {
      stop();
      setOn(false);
      return;
    }
    const dpip = (window as unknown as { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture;
    if (!dpip) {
      // No Document PiP (e.g. Firefox/Safari): just flag it on; the keep-alive
      // video + worker still run. Nothing to open.
      setOn(true);
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
          setOn(false);
        });
        startFeed();
        setOn(true);
      })
      .catch(() => {
        setOn(false);
      });
  }, [on, stop, startFeed]);

  // Close the PiP if this ever unmounts.
  useEffect(() => () => stop(), [stop]);

  return (
    <button
      onClick={toggle}
      title={
        on
          ? "Mostrando o relógio do jogo numa janelinha (não feche). Toque para desligar."
          : "Abre uma janelinha minúscula com o relógio do jogo para confirmar que a captura está ao vivo."
      }
      style={{
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
          style={{ width: 9, height: 9, borderRadius: 999, background: "#e5484d", display: "inline-block", flex: "0 0 auto" }}
        />
      ) : (
        <Tv size={15} />
      )}
      Modo Streamer
      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "rgba(0,0,0,0.18)", color: "var(--signal-ink)" }}>
        {on ? "Ativado" : "Desativado"}
      </span>
    </button>
  );
}
