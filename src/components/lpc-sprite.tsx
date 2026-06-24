"use client";
import { useEffect, useMemo, useRef, useState } from "react";

// LOCAL EXPERIMENT (/testsprite). Canvas compositor for Universal LPC layers:
// stacks N per-animation sheets and steps frames left→right on the chosen
// direction row. Crisp (no smoothing). See src/data/lpc.ts for the catalog.

const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const FRAME = 64;
const DIR_ROW: Record<string, number> = { n: 0, w: 1, s: 2, e: 3 };

const cache = new Map<string, HTMLImageElement>();
function loadImage(url: string): Promise<HTMLImageElement | null> {
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      cache.set(url, img);
      resolve(img);
    };
    img.onerror = () => resolve(null); // missing layer → just skip it
    img.src = url;
  });
}

export function LpcSprite({
  urls,
  dir = "s",
  fps = 8,
  scale = 3,
  playing = true,
}: {
  urls: string[];
  dir?: string;
  fps?: number;
  scale?: number;
  playing?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [imgs, setImgs] = useState<HTMLImageElement[]>([]);
  const key = useMemo(() => urls.join("|"), [urls]);

  // Load (and cache) the layer sheets whenever the character/anim changes.
  useEffect(() => {
    let alive = true;
    Promise.all(urls.map((u) => loadImage(`${ASSET_BASE}${u}`))).then((res) => {
      if (alive) setImgs(res.filter((x): x is HTMLImageElement => x != null));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Animate: one rAF loop steps the frame; the body sheet defines cycle length.
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (imgs.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.imageSmoothingEnabled = false;
    const cols = Math.max(1, Math.floor(imgs[0].width / FRAME));
    const row = DIR_ROW[dir] ?? 2;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    let raf = 0;
    let last = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const im of imgs) {
        const c = Math.max(1, Math.floor(im.width / FRAME));
        const f = frame % c;
        ctx.drawImage(im, f * FRAME, row * FRAME, FRAME, FRAME, 0, 0, FRAME * scale, FRAME * scale);
      }
    };
    const tick = (t: number) => {
      if (!last) last = t;
      if (playing && !reduce && t - last >= 1000 / fps) {
        frame = (frame + 1) % cols;
        last = t;
        draw();
      }
      raf = requestAnimationFrame(tick);
    };
    draw();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [imgs, dir, fps, scale, playing]);

  return (
    <canvas
      ref={ref}
      width={FRAME * scale}
      height={FRAME * scale}
      aria-hidden
      style={{ imageRendering: "pixelated", display: "block" }}
    />
  );
}
