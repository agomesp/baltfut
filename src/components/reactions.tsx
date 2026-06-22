"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

// Tap an emoji → it floats up for everyone watching the same match, via an
// ephemeral Supabase Realtime broadcast (no DB, no backend change). Frontend
// only; clients send and receive directly with the anon key. SECURITY: the
// received emoji is checked against this whitelist before rendering, so a
// malicious client can't push arbitrary markup/strings into the float layer
// (and React escapes text anyway). Only people with the site open participate.
const EMOJIS = ["⚽", "🔥", "🎉", "👏", "😱", "❤️"];
const ALLOWED = new Set(EMOJIS);

let nextId = 0;
interface Floater {
  id: number;
  emoji: string;
  left: number;
  dur: number;
}

export function Reactions({ matchId }: { matchId: string }) {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastBroadcast = useRef(0);

  const spawn = useCallback((emoji: string) => {
    if (!ALLOWED.has(emoji)) return; // ignore anything not in our set
    const f: Floater = { id: nextId++, emoji, left: 8 + Math.random() * 84, dur: 2400 + Math.random() * 1200 };
    setFloaters((cur) => [...cur.slice(-39), f]); // cap concurrent floaters
    window.setTimeout(() => setFloaters((cur) => cur.filter((x) => x.id !== f.id)), f.dur + 120);
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
    spawn(emoji); // instant local feedback
    const now = Date.now();
    if (now - lastBroadcast.current < 250) return; // light send throttle
    lastBroadcast.current = now;
    channelRef.current?.send({ type: "broadcast", event: "r", payload: { e: emoji } });
  }, [spawn]);

  return (
    <>
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 55 }}>
        {floaters.map((f) => (
          <span
            key={f.id}
            style={{ position: "absolute", bottom: 84, left: `${f.left}%`, fontSize: 30, animation: `baltfutFloat ${f.dur}ms ease-out forwards` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>
      <div
        style={{
          position: "fixed",
          bottom: 64,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 56,
          display: "flex",
          gap: 4,
          padding: "5px 8px",
          borderRadius: 999,
          background: "var(--surface)",
          border: "1px solid var(--line-2)",
          boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
        }}
      >
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => react(e)}
            title="Reagir"
            style={{ fontSize: 18, lineHeight: 1, padding: "4px 6px", borderRadius: 999, border: "none", background: "transparent", cursor: "pointer" }}
          >
            {e}
          </button>
        ))}
      </div>
    </>
  );
}
