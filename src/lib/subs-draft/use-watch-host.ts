"use client";

// Host side of watch-together: owns the channel + a coalescer, exposes a stable
// broadcast(state) the active view calls on each transition, and a live viewer
// count from presence. A no-op when disabled — the host's own play is untouched.
import { useCallback, useEffect, useRef, useState } from "react";
import { createWatchChannel, type WatchChannel } from "./watch-channel";
import { createWatchHost, type BroadcastState, type WatchHost } from "./watch-sync";
import type { Team } from "./engine";

export function useWatchHost(enabled: boolean, id: string, field: Team[]): { viewers: number; broadcast: (s: BroadcastState) => void } {
  const chanRef = useRef<WatchChannel | null>(null);
  const hostRef = useRef<WatchHost | null>(null);
  const fieldRef = useRef<Team[]>(field);
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    if (!enabled || !id) return;
    const ch = createWatchChannel(id);
    chanRef.current = ch;
    hostRef.current = createWatchHost((s) => ch.broadcast(s));
    ch.onPresence((n) => setViewers(Math.max(0, n - 1))); // exclude self
    ch.broadcastField(fieldRef.current); // the drafted rosters the viewer rebuilds from
    // the beat re-emits state AND the field so a late joiner on ANY transport eventually
    // has the teams (BroadcastChannel also answers a want-ping instantly; Supabase relies
    // on this since it has no server retention). The field content is stable, so a viewer
    // ignores identical re-sends — no repeated full-tournament replay.
    const beat = setInterval(() => {
      hostRef.current?.beat();
      chanRef.current?.broadcastField(fieldRef.current);
    }, 3000);
    return () => {
      clearInterval(beat);
      ch.close();
      chanRef.current = null;
      hostRef.current = null;
    };
  }, [enabled, id]);

  // Re-broadcast when the field itself changes (groups 48 → bracket 32-filtered) so a
  // viewer's byId stays a superset of every id the current phase references.
  useEffect(() => {
    fieldRef.current = field;
    if (enabled && id) chanRef.current?.broadcastField(field);
  }, [enabled, id, field]);

  // Reads the ref (never a captured value) — the reactions.tsx channelRef pattern,
  // so it's stable and adds no deps to the callers' broadcast effects.
  const broadcast = useCallback((state: BroadcastState) => { hostRef.current?.push(state); }, []);
  return { viewers, broadcast };
}
