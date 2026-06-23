"use client";

import { useEffect, useState } from "react";

/**
 * Watch the streamer's Kick chat (public Pusher WebSocket) and float each emote
 * used in chat onto the page, reusing the baltfutFloat animation — so the chat's
 * emotes appear live on the captured page.
 *
 * Browser-only: no server, no auth (the chatroom channel is public), no CORS
 * (WebSockets aren't CORS-restricted). The chatroom id is the one config value,
 * static per channel — from https://kick.com/api/v2/channels/<slug> → chatroom.id.
 *
 * SECURITY: chat content is untrusted, but we only extract the NUMERIC emote id
 * (`\d+`) and build a fixed-template files.kick.com URL — no arbitrary URL/markup
 * can be injected. A per-second cap keeps a busy chat from flooding the screen.
 *
 * Caveat: unofficial — if Kick changes the Pusher key or the event name
 * (`App\Events\ChatMessageEvent`), this quietly stops (no errors, just no floats).
 */
const PUSHER_WS = "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flash=false";
const CHATROOM_ID = 3360085; // locobaltar (static per channel)
const EMOTE_RE = /\[emote:(\d+):[^\]]*\]/g;
const MAX_PER_SEC = 5; // drop excess floaters when chat is busy

let fid = 0;
interface Floater {
  id: number;
  url: string;
  left: number;
  dur: number;
}

export function KickChatReactions({ chatroomId = CHATROOM_ID, maxPerMsg = 4 }: { chatroomId?: number; maxPerMsg?: number }) {
  const [floaters, setFloaters] = useState<Floater[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let ws: WebSocket | null = null;
    let stopped = false;
    let retry: number | undefined;
    let recent: number[] = []; // timestamps for the per-second rate limit

    const float = (url: string) => {
      const now = Date.now();
      recent = recent.filter((t) => now - t < 1000);
      if (recent.length >= MAX_PER_SEC) return; // busy chat — drop the excess
      recent.push(now);
      const f: Floater = { id: fid++, url, left: 4 + Math.random() * 90, dur: 3600 + Math.random() * 1800 };
      setFloaters((cur) => [...cur.slice(-39), f]); // cap concurrent
      window.setTimeout(() => setFloaters((cur) => cur.filter((x) => x.id !== f.id)), f.dur + 150);
    };

    const connect = () => {
      ws = new WebSocket(PUSHER_WS);
      ws.onmessage = (e) => {
        let msg: { event?: string; data?: string };
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.event === "pusher:connection_established") {
          ws?.send(JSON.stringify({ event: "pusher:subscribe", data: { channel: `chatrooms.${chatroomId}.v2` } }));
        }
        if (msg.event === "App\\Events\\ChatMessageEvent") {
          try {
            const p = JSON.parse(msg.data ?? "{}") as { content?: string };
            const ids = [...(p.content ?? "").matchAll(EMOTE_RE)].map((m) => m[1]).slice(0, maxPerMsg);
            for (const id of ids) float(`https://files.kick.com/emotes/${id}/fullsize`);
          } catch { /* ignore */ }
        }
      };
      ws.onclose = () => { if (!stopped) retry = window.setTimeout(connect, 3000); };
    };
    connect();

    return () => {
      stopped = true;
      window.clearTimeout(retry);
      ws?.close();
    };
  }, [chatroomId, maxPerMsg]);

  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 54 }}>
      {floaters.map((f) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={f.id}
          src={f.url}
          alt=""
          style={{ position: "absolute", bottom: 54, left: `${f.left}%`, width: 44, height: 44, objectFit: "contain", pointerEvents: "none", animation: `baltfutFloat ${f.dur}ms ease-out forwards` }}
        />
      ))}
    </div>
  );
}
