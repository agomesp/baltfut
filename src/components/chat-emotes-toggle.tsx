"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { MONO } from "@/components/primitives";

/**
 * On/off control for floating the Kick chat emotes (KickChatReactions listens for
 * the toggle event). ON by default; the choice persists in localStorage so it
 * survives reloads (incl. Modo Streamer's). Lives in the bottom-right control
 * cluster next to PiP / Modo Streamer.
 */
export const CHAT_EMOTES_KEY = "baltfut_chat_emotes";
export const CHAT_EMOTES_EVENT = "baltfut-chat-emotes";

/** Whether chat-emote floating is on (default on; off only if explicitly set). */
export function chatEmotesOn(): boolean {
  try {
    return localStorage.getItem(CHAT_EMOTES_KEY) !== "off";
  } catch {
    return true;
  }
}

export function ChatEmotesToggle() {
  const [on, setOn] = useState(true);

  // localStorage isn't available during static prerender — read after mount.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setOn(chatEmotesOn());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggle = () => {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(CHAT_EMOTES_KEY, next ? "on" : "off");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(CHAT_EMOTES_EVENT));
  };

  return (
    <button
      onClick={toggle}
      title={on ? "Emotes do chat da Kick flutuando — toque para desligar." : "Emotes do chat desligados — toque para ligar."}
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
        background: on ? "var(--signal)" : "var(--surface)",
        color: on ? "var(--signal-ink)" : "var(--ink-2)",
        border: `1px solid ${on ? "transparent" : "var(--line-2)"}`,
      }}
    >
      <MessageSquare size={15} />
      Emotes
      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "rgba(0,0,0,0.18)", color: on ? "var(--signal-ink)" : "var(--ink-3)" }}>
        {on ? "Ativado" : "Desativado"}
      </span>
    </button>
  );
}
