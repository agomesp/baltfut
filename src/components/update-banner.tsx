"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BUILD_ID, hasNewVersion } from "@/lib/version";
import { isStreamerMode, subscribeStreamerMode } from "@/lib/streamer-mode";
import { shouldAutoReload } from "@/lib/auto-reload";
import { MONO } from "@/components/primitives";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const CHECK_MS = 30_000; // how often to check for a new deploy
const AUTO_APPLY_MS = 8_000; // grace before auto-reloading

/**
 * Detects a new deploy (the served version.json id differs from the one baked
 * into this bundle) and shows a banner. Auto-reloads after a short grace period,
 * but never while the user is typing a palpite. Inert in dev / when unconfigured.
 */
export function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  // Modo Streamer suppresses the force-reload — it would blank the live capture.
  const streaming = useSyncExternalStore(subscribeStreamerMode, isStreamerMode, () => false);

  useEffect(() => {
    if (BUILD_ID === "dev") return;
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch(`${BASE}/version.json?ts=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { id?: string };
        if (alive && hasNewVersion(BUILD_ID, data.id)) setAvailable(true);
      } catch {
        /* offline / transient — ignore */
      }
    };
    void check();
    const id = setInterval(check, CHECK_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!available || streaming) return;
    const id = setInterval(() => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      // Never reload a broadcasting, hidden/occluded, or mid-palpite tab — each
      // of those turns the "update" into a blank screen.
      if (shouldAutoReload({ typing, streaming, hidden: document.hidden })) {
        window.location.reload();
      }
    }, AUTO_APPLY_MS);
    return () => clearInterval(id);
  }, [available, streaming]);

  if (!available || streaming) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 20,
        transform: "translateX(-50%)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--surface)",
        border: "1px solid var(--line-2)",
        borderRadius: 999,
        padding: "10px 12px 10px 16px",
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.03em", color: "var(--ink)" }}>
        Nova versão disponível
      </span>
      <button
        onClick={() => window.location.reload()}
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--signal-ink)",
          background: "var(--signal)",
          border: "none",
          borderRadius: 999,
          padding: "6px 12px",
          cursor: "pointer",
        }}
      >
        Atualizar
      </button>
    </div>
  );
}
