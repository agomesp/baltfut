"use client";

import { useEffect, useState } from "react";
import { CHAT_EMOTES_EVENT, chatEmotesOn } from "@/components/chat-emotes-toggle";
import { subscribeKickChat, KICK_CHATROOM_ID } from "@/lib/kick-chat";

/**
 * Watch the streamer's Kick chat (public Pusher WebSocket) and float each emote
 * used in chat onto the page, reusing the baltfutFloat animation — so the chat's
 * emotes appear live on the captured page.
 *
 * SECURITY: chat content is untrusted, but we only extract the NUMERIC emote id
 * (`\d+`) and build a fixed-template files.kick.com URL — no arbitrary URL/markup
 * can be injected. A per-second cap keeps a busy chat from flooding the screen.
 *
 * The socket/connection lives in the shared kick-chat helper.
 */
const CHATROOM_ID = KICK_CHATROOM_ID;
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
  const [enabled, setEnabled] = useState(true);

  // Follow the on/off toggle (ChatEmotesToggle). Read after mount (no localStorage
  // during prerender) and react to toggle events.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setEnabled(chatEmotesOn());
    const onToggle = () => setEnabled(chatEmotesOn());
    window.addEventListener(CHAT_EMOTES_EVENT, onToggle);
    return () => window.removeEventListener(CHAT_EMOTES_EVENT, onToggle);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return; // off → no WS, no floats

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

    return subscribeKickChat(chatroomId, (content) => {
      const ids = [...content.matchAll(EMOTE_RE)].map((m) => m[1]).slice(0, maxPerMsg);
      for (const id of ids) float(`https://files.kick.com/emotes/${id}/fullsize`);
    });
  }, [chatroomId, maxPerMsg, enabled]);

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
