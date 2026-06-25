"use client";

import { useEffect } from "react";
import { isStreamerMode, subscribeStreamerMode } from "@/lib/streamer-mode";

/**
 * Mirrors Modo Streamer into a `<html data-lite>` attribute so CSS can drop the
 * idle decorative animations + the cinematic's full-screen blur while a broadcast
 * is live — keeping GPU headroom for OBS. The goal cinematic + score/clock stay.
 * Renders nothing.
 */
export function LiteMode() {
  useEffect(() => {
    const apply = () => document.documentElement.toggleAttribute("data-lite", isStreamerMode());
    apply();
    return subscribeStreamerMode(apply);
  }, []);
  return null;
}
