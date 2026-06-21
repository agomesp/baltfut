"use client";

import { useEffect, useState } from "react";
import { MONO } from "@/components/primitives";

/**
 * Kiosk / streamer mode. Add `?tv` to the URL (optionally `?tv=20` for a custom
 * interval in seconds) and the page hard-reloads itself on that cadence.
 *
 * Why a full reload instead of our in-page polling: when the page is a background
 * capture window (OBS on top, another app focused, minimized), the browser
 * throttles setInterval to ~once/min AND can discard the tab entirely — the
 * screen goes grey and no JS runs, so no in-page trick (not even the silent-audio
 * keepalive) can recover it. A <meta http-equiv="refresh"> is a browser-scheduled
 * navigation, not a JS timer, so it keeps firing while hidden, and a tab that
 * keeps navigating is never put to sleep. The app defaults to AO VIVO and
 * auto-selects the live match, so every reload lands back on the current game.
 */
export function KioskReload() {
  const [secs, setSecs] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("tv")) return;
    const raw = Number(params.get("tv"));
    const interval = Number.isFinite(raw) && raw >= 10 ? Math.min(raw, 600) : 30;

    // Primary: native meta-refresh (survives background throttling + discard).
    const meta = document.createElement("meta");
    meta.httpEquiv = "refresh";
    meta.content = String(interval); // empty URL → reloads current URL, keeping ?tv
    document.head.appendChild(meta);

    // Backup: a JS reload a touch later, in case meta-refresh is ever deferred.
    const id = window.setTimeout(() => window.location.reload(), (interval + 5) * 1000);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSecs(interval);
    return () => {
      meta.remove();
      window.clearTimeout(id);
    };
  }, []);

  if (secs == null) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 10,
        right: 12,
        zIndex: 60,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--signal-strong)",
        background: "rgba(0,0,0,0.55)",
        border: "1px solid var(--line-2)",
        borderRadius: 999,
        padding: "4px 9px",
        pointerEvents: "none",
      }}
    >
      ● Modo TV · recarrega a cada {secs}s
    </div>
  );
}
