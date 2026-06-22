"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Smile, X } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

// Tap an emoji → it balloons up to the top of the page for everyone watching the
// same match, via an ephemeral Supabase Realtime broadcast (no DB, no backend
// change). SECURITY: received emojis are whitelisted before render (and React
// escapes text), so a client can't inject markup. Only site-open users join in.
const EMOJIS = ["⚽", "🔥", "🎉", "👏", "😱", "❤️"];
const ALLOWED = new Set(EMOJIS);
const COOLDOWN_MS = 800; // min gap between this user's reactions (anti-spam)

let nextId = 0;
interface Floater {
  id: number;
  emoji: string;
  left: number;
  dur: number;
}

export function Reactions({ matchId }: { matchId: string }) {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [open, setOpen] = useState(true);
  const [cooling, setCooling] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastReact = useRef(0);

  const spawn = useCallback((emoji: string) => {
    if (!ALLOWED.has(emoji)) return; // ignore anything outside our set
    const f: Floater = { id: nextId++, emoji, left: 6 + Math.random() * 88, dur: 3600 + Math.random() * 1800 };
    setFloaters((cur) => [...cur.slice(-39), f]); // cap concurrent floaters
    window.setTimeout(() => setFloaters((cur) => cur.filter((x) => x.id !== f.id)), f.dur + 150);
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    const channel = client
      .channel(`reactions:${matchId}`)
      .on("broadcast", { event: "r" }, (msg) => spawn(String((msg.payload as { e?: unknown })?.e ?? "")))
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [matchId, spawn]);

  const react = useCallback((emoji: string) => {
    const now = Date.now();
    if (now - lastReact.current < COOLDOWN_MS) return; // cooldown: ignore rapid taps
    lastReact.current = now;
    setCooling(true);
    window.setTimeout(() => setCooling(false), COOLDOWN_MS);
    spawn(emoji); // instant local feedback
    channelRef.current?.send({ type: "broadcast", event: "r", payload: { e: emoji } });
  }, [spawn]);

  return (
    <>
      {/* Float layer — pointer-events disabled so taps fall through to the page. */}
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 55 }}>
        {floaters.map((f) => (
          <span
            key={f.id}
            style={{ position: "absolute", bottom: 54, left: `${f.left}%`, fontSize: 30, pointerEvents: "none", animation: `baltfutFloat ${f.dur}ms ease-out forwards` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      <div style={{ position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 56 }}>
        {/* Expanded emoji bar (collapses with a fade/scale). */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "5px 6px 5px 10px",
            borderRadius: 999,
            background: "var(--surface)",
            border: "1px solid var(--line-2)",
            boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
            overflow: "visible", // let a magnified emoji pop out of the bar
            transition: "opacity .2s ease, transform .2s ease",
            opacity: open ? 1 : 0,
            transform: open ? "scale(1)" : "scale(.8) translateY(10px)",
            pointerEvents: open ? "auto" : "none",
          }}
        >
          <div style={{ display: "flex", gap: 2, opacity: cooling ? 0.4 : 1, transition: "opacity .15s ease" }}>
            {EMOJIS.map((e) => (
              <button key={e} className="rx-btn" onClick={() => react(e)} title="Reagir">
                {e}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOpen(false)}
            title="Fechar reações"
            aria-label="Fechar reações"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, marginLeft: 4, borderRadius: 999, border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer" }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Collapsed circle (cross-fades with the bar). */}
        <button
          onClick={() => setOpen(true)}
          title="Reagir"
          aria-label="Abrir reações"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            width: 38,
            height: 38,
            borderRadius: 999,
            background: "var(--surface)",
            border: "1px solid var(--line-2)",
            boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
            color: "var(--ink-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "opacity .2s ease, transform .2s ease",
            opacity: open ? 0 : 1,
            transform: open ? "translateX(-50%) scale(.8)" : "translateX(-50%) scale(1)",
            pointerEvents: open ? "none" : "auto",
          }}
        >
          <Smile size={18} />
        </button>
      </div>
    </>
  );
}
