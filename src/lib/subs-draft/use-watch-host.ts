"use client";

// Host side of watch-together: owns the channel + a coalescer, exposes a stable
// broadcast(state) the active view calls on each transition, and a live viewer
// count from presence. A no-op when disabled — the host's own play is untouched.
import { useCallback, useEffect, useRef, useState } from "react";
import { createWatchChannel, type WatchChannel } from "./watch-channel";
import { createWatchHost, type BroadcastState, type WatchHost } from "./watch-sync";

export function useWatchHost(enabled: boolean, id: string): { viewers: number; broadcast: (s: BroadcastState) => void } {
  const chanRef = useRef<WatchChannel | null>(null);
  const hostRef = useRef<WatchHost | null>(null);
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    if (!enabled || !id) return;
    const ch = createWatchChannel(id);
    chanRef.current = ch;
    hostRef.current = createWatchHost((s) => ch.broadcast(s));
    ch.onPresence((n) => setViewers(Math.max(0, n - 1))); // exclude self
    const beat = setInterval(() => hostRef.current?.beat(), 3000); // re-emit for late joiners
    return () => {
      clearInterval(beat);
      ch.close();
      chanRef.current = null;
      hostRef.current = null;
    };
  }, [enabled, id]);

  // Reads the ref (never a captured value) — the reactions.tsx channelRef pattern,
  // so it's stable and adds no deps to the callers' broadcast effects.
  const broadcast = useCallback((state: BroadcastState) => { hostRef.current?.push(state); }, []);
  return { viewers, broadcast };
}
