"use client";

/**
 * Shared connection to the streamer's public Kick chat (Pusher WebSocket). Browser
 * only, no auth (the chatroom channel is public), no CORS (WebSockets aren't
 * CORS-restricted). The chatroom id is the one config value, static per channel:
 * from https://kick.com/api/v2/channels/<slug> → chatroom.id.
 *
 * `subscribeKickChat` invokes `onContent` with each chat message's raw content
 * string and returns a stop() that closes the socket + cancels the reconnect. Both
 * the emote-floater and the promo-command listeners ride this one helper.
 *
 * Caveat: unofficial — if Kick changes the Pusher key or the event name
 * (`App\Events\ChatMessageEvent`), this quietly stops (no errors, just silence).
 */
export const KICK_PUSHER_WS =
  "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flash=false";
export const KICK_CHATROOM_ID = 3360085; // locobaltar (static per channel)

export function subscribeKickChat(chatroomId: number, onContent: (content: string) => void): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let retry: number | undefined;

  const connect = () => {
    ws = new WebSocket(KICK_PUSHER_WS);
    ws.onmessage = (e) => {
      let msg: { event?: string; data?: string };
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.event === "pusher:connection_established") {
        ws?.send(JSON.stringify({ event: "pusher:subscribe", data: { channel: `chatrooms.${chatroomId}.v2` } }));
      }
      if (msg.event === "App\\Events\\ChatMessageEvent") {
        try {
          const p = JSON.parse(msg.data ?? "{}") as { content?: string };
          onContent(p.content ?? "");
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
}
