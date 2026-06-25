"use client";
import { useEffect, useRef, useState } from "react";

// LOCAL EXPERIMENT (/testsprite). Plays a PixelLab animation: a folder of
// per-frame transparent PNGs (0.png..N-1.png) cycled on a crisp canvas. Mirrors
// LpcSprite, but PixelLab exports one image per frame (not a strip). Each clip is
// one direction (the hero side/front view).

const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const cache = new Map<string, HTMLImageElement>();
function load(url: string): Promise<HTMLImageElement | null> {
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { cache.set(url, img); resolve(img); };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function PixelLabAnim({
  dir,
  frames,
  size = 92,
  scale = 2,
  fps = 9,
  playing = true,
  loop = true,
}: {
  /** Folder under public/ holding 0.png..(frames-1).png (no trailing slash). */
  dir: string;
  frames: number;
  size?: number;
  scale?: number;
  fps?: number;
  playing?: boolean;
  /** When false, stop (hold) on the last frame instead of cycling. */
  loop?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [imgs, setImgs] = useState<HTMLImageElement[]>([]);

  useEffect(() => {
    let alive = true;
    const urls = Array.from({ length: frames }, (_, i) => `${ASSET_BASE}${dir}/${i}.png`);
    Promise.all(urls.map(load)).then((res) => {
      if (alive) setImgs(res.filter((x): x is HTMLImageElement => x != null));
    });
    return () => { alive = false; };
  }, [dir, frames]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || imgs.length === 0) { ctx?.clearRect(0, 0, canvas.width, canvas.height); return; }
    ctx.imageSmoothingEnabled = false;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let i = 0, raf = 0, last = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const im = imgs[i % imgs.length];
      ctx.drawImage(im, 0, 0, im.width, im.height, 0, 0, size * scale, size * scale);
    };
    const tick = (t: number) => {
      if (!last) last = t;
      if (playing && !reduce && t - last >= 1000 / fps) {
        i = loop ? (i + 1) % imgs.length : Math.min(i + 1, imgs.length - 1);
        last = t;
        draw();
      }
      raf = requestAnimationFrame(tick);
    };
    draw();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [imgs, size, scale, fps, playing, loop]);

  return (
    <canvas ref={ref} width={size * scale} height={size * scale} aria-hidden style={{ imageRendering: "pixelated", display: "block" }} />
  );
}
