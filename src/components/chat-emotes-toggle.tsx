"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";

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
        fontFamily: "var(--font-jb)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "9px 13px",
        borderRadius: 8,
        cursor: "pointer",
        boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
        background: on ? "#c8ff2d" : "rgba(255,255,255,0.04)",
        color: on ? "#0f1f02" : "#9bb6a6",
        border: `1px solid ${on ? "transparent" : "rgba(255,255,255,0.14)"}`,
      }}
    >
      <MessageSquare size={15} />
      Emotes
      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: on ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.06)", color: on ? "#0f1f02" : "#9bb6a6" }}>
        {on ? "ATIVADO" : "DESATIVADO"}
      </span>
    </button>
  );
}
