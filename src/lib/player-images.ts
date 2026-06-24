import { CRAQUES, type CraquePlayer } from "@/data/craques";

export type { CraquePlayer };

/**
 * Feature flag: render per-team "craque" cutouts on the AO VIVO hero. OFF unless
 * NEXT_PUBLIC_PLAYER_CUTOUTS === "1", so the shipped redesign stays flags-only
 * until a curated, license-checked image set exists. See
 * docs/player-images-spike.md.
 */
export const PLAYER_CUTOUTS_ENABLED = process.env.NEXT_PUBLIC_PLAYER_CUTOUTS === "1";

/** Ordered squad cutouts for a FIFA code (empty when none are seeded). */
export function squadFor(code: string): CraquePlayer[] {
  return CRAQUES[code] ?? [];
}

/** The hero "craque" pick for a team — the first seeded entry, or null. */
export function craqueFor(code: string): CraquePlayer | null {
  return squadFor(code)[0] ?? null;
}

/** Public URL for a cutout image, basePath-aware (mirrors the /flags resolution). */
export function playerCutoutSrc(img: string, assetBase: string): string {
  return `${assetBase}/players/${img}`;
}
