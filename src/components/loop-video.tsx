"use client";

import { useEffect, useRef, type CSSProperties } from "react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * A muted, seamlessly-looping background video. Muted autoplays with no user
 * gesture and survives reloads; `onCanPlay` + a visibility nudge + a slow re-arm
 * keep it playing even if it loads while the tab is hidden. A continuously
 * playing video keeps the compositor producing frames, which is what stops an
 * OBS/stream capture from freezing on the last frame when the window is hidden.
 *
 * `blend` uses mix-blend-mode: screen so a black-background clip (e.g. the live
 * dot or the flag shine) composites its bright parts only — no alpha codec needed.
 */
export function LoopVideo({
  srcs,
  style,
  blend = false,
}: {
  srcs: string[];
  style?: CSSProperties;
  blend?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const play = () => void v.play?.().catch(() => {});
    play();
    const onVis = () => {
      if (!document.hidden) play();
    };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(play, 10_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, []);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      autoPlay
      aria-hidden
      tabIndex={-1}
      onCanPlay={(e) => void e.currentTarget.play().catch(() => {})}
      style={{ ...style, ...(blend ? { mixBlendMode: "screen" as const } : null) }}
    >
      {srcs.map((s) => (
        <source key={s} src={`${BASE}/${s}`} type={s.endsWith(".webm") ? "video/webm" : "video/mp4"} />
      ))}
    </video>
  );
}
