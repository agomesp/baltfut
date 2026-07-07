"use client";

import { useEffect, useState } from "react";
import { MY_NAME_EVENT } from "@/lib/use-my-name";
import { isStreamerMachine } from "@/lib/streamer-identity";
import { subscribeKickChat, KICK_CHATROOM_ID } from "@/lib/kick-chat";
import { parsePromoCommand } from "@/lib/promo-command";
import { applyPromoCommand } from "@/lib/promo-display";

/**
 * Lets viewers drive the streamer's promo view from Kick chat: `!promo` shows the
 * RB Store promos, `!palpites` shows the palpites (unless the streamer has locked
 * promos on). Renders nothing.
 *
 * Only the streamer's machine reacts (its browser is the captured on-stream screen),
 * so this connects to chat ONLY when localStorage says we're "Rodrigo Baltar" — no
 * other viewer's page flips, and no needless socket on every visitor.
 */
export function PromoChatCommands({ chatroomId = KICK_CHATROOM_ID }: { chatroomId?: number }) {
  const [isStreamer, setIsStreamer] = useState(false);

  // Read after mount (no localStorage during prerender); re-check if the name is
  // claimed/cleared later (same-tab MY_NAME_EVENT, cross-tab storage).
  useEffect(() => {
    const read = () => setIsStreamer(isStreamerMachine());
    read();
    window.addEventListener(MY_NAME_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(MY_NAME_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !isStreamer) return; // only the captured screen
    return subscribeKickChat(chatroomId, (content) => {
      const cmd = parsePromoCommand(content);
      if (cmd) applyPromoCommand(cmd);
    });
  }, [isStreamer, chatroomId]);

  return null;
}
