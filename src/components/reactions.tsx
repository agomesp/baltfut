"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Smile, X } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

// Tap a reaction → its image balloons up to the top of the page for everyone
// watching the same match, via an ephemeral Supabase Realtime broadcast (no DB).
// SECURITY: the broadcast carries only a short id; we map it to a known image src
// from our own list, so a client can NEVER inject an arbitrary URL (unknown ids
// are ignored). Only site-open users join in.
// Reaction images are Kick emotes (animated GIFs — <img> renders them animated),
// in bar order. The kick URL is primary; if it 404s / goes down, onError swaps to
// a self-hosted copy under public/reactions/ (downloaded fallbacks).
const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const REACTIONS: { id: string; src: string; fallback: string }[] = [
  { id: "r1", src: "https://files.kick.com/emotes/4147884/fullsize", fallback: "reactions/r1.gif" },
  { id: "r2", src: "https://files.kick.com/emotes/37226/fullsize", fallback: "reactions/r2.png" },
  { id: "r3", src: "https://files.kick.com/emotes/37225/fullsize", fallback: "reactions/r3.png" },
  { id: "r4", src: "https://files.kick.com/emotes/4148085/fullsize", fallback: "reactions/r4.gif" },
  { id: "r5", src: "https://files.kick.com/emotes/37240/fullsize", fallback: "reactions/r5.png" },
  { id: "r6", src: "https://files.kick.com/emotes/39261/fullsize", fallback: "reactions/r6.gif" },
];
const BY_ID = new Map(REACTIONS.map((r) => [r.id, r]));
// On a failed remote load, swap to the local fallback once (guard avoids a loop).
function swapToFallback(img: HTMLImageElement, fallback: string) {
  if (img.dataset.fb) return;
  img.dataset.fb = "1";
  img.src = `${ASSET_BASE}/${fallback}`;
}
const COOLDOWN_MS = 800; // min gap between this user's reactions (anti-spam)

let nextId = 0;
interface Floater {
  id: number;
  rid: string;
  left: number;
  dur: number;
}

export function Reactions({ matchId }: { matchId: string }) {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [open, setOpen] = useState(true);
  const [cooling, setCooling] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastReact = useRef(0);

  const spawn = useCallback((rid: string) => {
    if (!BY_ID.has(rid)) return; // ignore anything outside our set
    const f: Floater = { id: nextId++, rid, left: 6 + Math.random() * 88, dur: 3600 + Math.random() * 1800 };
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

  const react = useCallback((rid: string) => {
    const now = Date.now();
    if (now - lastReact.current < COOLDOWN_MS) return; // cooldown: ignore rapid taps
    lastReact.current = now;
    setCooling(true);
    window.setTimeout(() => setCooling(false), COOLDOWN_MS);
    spawn(rid); // instant local feedback
    channelRef.current?.send({ type: "broadcast", event: "r", payload: { e: rid } });
  }, [spawn]);

  return (
    <>
      {/* Float layer — pointer-events disabled so taps fall through to the page. */}
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 55 }}>
        {floaters.map((f) => {
          const r = BY_ID.get(f.rid);
          return r ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={f.id}
              src={r.src}
              alt=""
              onError={(e) => swapToFallback(e.currentTarget, r.fallback)}
              style={{ position: "absolute", bottom: 54, left: `${f.left}%`, width: 44, height: 44, objectFit: "contain", pointerEvents: "none", animation: `baltfutFloat ${f.dur}ms ease-out forwards` }}
            />
          ) : null;
        })}
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
            background: "rgba(7,20,13,0.82)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
            overflow: "visible", // let a magnified emoji pop out of the bar
            transition: "opacity .2s ease, transform .2s ease",
            opacity: open ? 1 : 0,
            transform: open ? "scale(1)" : "scale(.8) translateY(10px)",
            pointerEvents: open ? "auto" : "none",
          }}
        >
          <div style={{ display: "flex", gap: 2, opacity: cooling ? 0.4 : 1, transition: "opacity .15s ease" }}>
            {REACTIONS.map((r) => (
              <button key={r.id} className="rx-btn" onClick={() => react(r.id)} title="Reagir">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.src} alt="" width={28} height={28} onError={(e) => swapToFallback(e.currentTarget, r.fallback)} style={{ width: 28, height: 28, objectFit: "contain", display: "block" }} />
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
            background: "rgba(7,20,13,0.82)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
            color: "#9bb6a6",
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
