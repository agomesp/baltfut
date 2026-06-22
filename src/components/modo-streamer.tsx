"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tv } from "lucide-react";
import { MONO } from "@/components/primitives";

/**
 * Modo Streamer — PiP keep-alive. OFF by default; the user must turn it on.
 *
 * Clicking it ON opens a small, always-on-top Document Picture-in-Picture window
 * (the click is the user gesture browsers require — a PiP can't auto-open on
 * load). That window never gets occluded or throttled, which keeps the page
 * "active" so the score + subs keep auto-updating for an OBS capture. Closing the
 * PiP turns the mode off; while it's on the page does NOT auto-reload, so the PiP
 * stays open. Unsupported browsers (no Document PiP) just toggle the flag.
 *
 * Caveat: this keeps the page active and the PiP painted; it does not force a
 * fully-covered main window to keep painting — for that, capture the PiP window
 * or use an OBS Browser Source.
 */
const PIP_STYLE =
  "html,body{margin:0;height:100%}" +
  "body{background:#0b0b0c;color:#d8d8d2;display:flex;align-items:center;justify-content:center;" +
  "font-family:ui-monospace,Menlo,Consolas,monospace}" +
  ".s{font-size:11px;line-height:1.45;letter-spacing:.02em;text-align:center;padding:8px 10px}" +
  ".d{display:inline-block;width:7px;height:7px;border-radius:999px;background:#e5484d;" +
  "margin-right:6px;vertical-align:middle;animation:b 1.4s ease-in-out infinite}" +
  "@keyframes b{0%,100%{opacity:1}50%{opacity:.2}}";

interface DocumentPiP {
  requestWindow: (opts: { width: number; height: number }) => Promise<Window>;
}

export function ModoStreamer() {
  const [on, setOn] = useState(false);
  const pipRef = useRef<Window | null>(null);

  const closePip = useCallback(() => {
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

  const toggle = useCallback(() => {
    if (on) {
      closePip();
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
    // Must be called during this click's user activation.
    dpip
      .requestWindow({ width: 240, height: 64 })
      .then((pip) => {
        pipRef.current = pip;
        const st = pip.document.createElement("style");
        st.textContent = PIP_STYLE;
        pip.document.head.appendChild(st);
        const el = pip.document.createElement("div");
        el.className = "s";
        el.innerHTML = '<span class="d"></span>Atualizando placar p/ os subs — não feche';
        pip.document.body.appendChild(el);
        pip.addEventListener("pagehide", () => {
          pipRef.current = null;
          setOn(false);
        });
        setOn(true);
      })
      .catch(() => {
        setOn(false);
      });
  }, [on, closePip]);

  // Close the PiP if this ever unmounts.
  useEffect(() => () => closePip(), [closePip]);

  return (
    <button
      onClick={toggle}
      title={
        on
          ? "Mantendo a página ativa numa janelinha (não feche). Toque para desligar."
          : "Abre uma janelinha que mantém o placar atualizando em segundo plano (ex.: OBS)."
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
