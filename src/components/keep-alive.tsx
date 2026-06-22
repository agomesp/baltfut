"use client";

import { LoopVideo } from "@/components/loop-video";

/**
 * KeepAlive — a tiny, always-playing muted video pinned as a thin accent line.
 *
 * Why: when the streamer alt-tabs into a fullscreen app, the window holding
 * BaltFut becomes hidden/occluded; Chrome then throttles timers and stops the
 * compositor producing new frames, so an OBS capture freezes on the last painted
 * frame (the score looks stuck). ge.globo doesn't freeze because it always has a
 * playing <video>, which keeps the compositor emitting frames. This is our
 * equivalent — visible as a subtle "live" sheen rather than a hidden hack.
 *
 * Addresses the PAINT layer. For a fully-occluded window on Windows also set
 * OBS to "Windows Graphics Capture" (see STREAMING.md) — the two together fix it.
 */
export function KeepAlive() {
  return (
    <LoopVideo
      srcs={["keepalive.webm", "keepalive.mp4"]}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: 4,
        objectFit: "cover",
        zIndex: 40,
        pointerEvents: "none",
        opacity: 0.6,
      }}
    />
  );
}
