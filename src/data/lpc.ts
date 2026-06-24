/**
 * LOCAL EXPERIMENT — Universal LPC Spritesheet asset catalog for /testsprite.
 *
 * Layers are composited (body → legs → shirt → head → hair, by zPos) from the
 * per-animation PNGs vendored under public/lpc-assets/ (NOT versioned). Each
 * `walk|run|slash.png` is a 9×4 grid (cols = frames, rows = N/W/S/E @ 64px).
 *
 * Art: Universal LPC Spritesheet (Liberated Pixel Cup). CC-BY-SA 3.0 / GPL 3.0 /
 * OGA-BY 3.0. https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator
 */
export type Anim = "walk" | "run" | "slash";
export const ANIMS: Anim[] = ["walk", "run", "slash"];

export interface LpcOption {
  label: string;
  /** Path under ASSET_BASE; `{anim}` and (optionally) `{color}` are substituted. */
  tmpl: string;
  colors?: string[];
}
export interface LpcLayer {
  key: string;
  label: string;
  zPos: number;
  optional?: boolean;
  options: LpcOption[];
}

const P = "/lpc-assets/spritesheets";

// Ordered by zPos so resolveUrls() yields a correct paint order.
export const LAYERS: LpcLayer[] = [
  {
    key: "body",
    label: "Body",
    zPos: 10,
    options: [
      { label: "Male", tmpl: `${P}/body/bodies/male/{anim}.png` },
      { label: "Female", tmpl: `${P}/body/bodies/female/{anim}.png` },
      { label: "Muscular", tmpl: `${P}/body/bodies/muscular/{anim}.png` },
    ],
  },
  {
    key: "legs",
    label: "Legs",
    zPos: 30,
    optional: true,
    options: [
      { label: "Pants", tmpl: `${P}/legs/pants/male/{anim}.png` },
      {
        label: "Pants (colored)",
        tmpl: `${P}/legs/pants/female/{anim}/{color}.png`,
        colors: ["navy", "blue", "forest", "maroon", "red", "white"],
      },
    ],
  },
  {
    key: "shirt",
    label: "Shirt",
    zPos: 35,
    optional: true,
    // NOTE: only a female blouse was fetched; on male/muscular bodies it can sit
    // slightly off at the shoulders (experiment limitation, not a bug).
    options: [
      {
        label: "Blouse",
        tmpl: `${P}/torso/clothes/blouse_longsleeve/female/{anim}/{color}.png`,
        colors: ["lavender", "blue", "green", "maroon"],
      },
    ],
  },
  {
    key: "head",
    label: "Head",
    zPos: 80,
    options: [
      { label: "Human (m)", tmpl: `${P}/head/heads/human/male/{anim}.png` },
      { label: "Human (f)", tmpl: `${P}/head/heads/human/female/{anim}.png` },
      { label: "Orc", tmpl: `${P}/head/heads/orc/male/{anim}.png` },
    ],
  },
  {
    key: "hair",
    label: "Hair",
    zPos: 90,
    optional: true,
    options: [
      { label: "Afro", tmpl: `${P}/hair/afro/adult/{anim}.png` },
      { label: "Bob", tmpl: `${P}/hair/bob/adult/{anim}.png` },
      { label: "Buzzcut", tmpl: `${P}/hair/buzzcut/adult/{anim}.png` },
      { label: "Curly", tmpl: `${P}/hair/curly_long/adult/{anim}.png` },
    ],
  },
];

/** A per-layer pick. `null` = layer turned off. */
export type Choice = { opt: number; color?: string } | null;

/** Resolve a character's layer picks into z-ordered image paths for one anim. */
export function resolveUrls(choices: Record<string, Choice>, anim: Anim): string[] {
  return [...LAYERS]
    .sort((a, b) => a.zPos - b.zPos)
    .flatMap((layer) => {
      const ch = choices[layer.key];
      if (!ch) return [];
      const opt = layer.options[ch.opt];
      if (!opt) return [];
      let url = opt.tmpl.replace("{anim}", anim);
      if (opt.colors) url = url.replace("{color}", ch.color ?? opt.colors[0]);
      return [url];
    });
}

/** Preset cast for the "variations walking" gallery. */
export const PRESETS: { name: string; choices: Record<string, Choice> }[] = [
  { name: "Striker", choices: { body: { opt: 0 }, head: { opt: 0 }, hair: { opt: 0 }, legs: { opt: 1, color: "navy" } } },
  { name: "Keeper", choices: { body: { opt: 2 }, head: { opt: 0 }, hair: { opt: 2 }, legs: { opt: 1, color: "forest" } } },
  { name: "Playmaker", choices: { body: { opt: 1 }, head: { opt: 1 }, hair: { opt: 1 }, shirt: { opt: 0, color: "lavender" }, legs: { opt: 1, color: "maroon" } } },
  { name: "Winger", choices: { body: { opt: 1 }, head: { opt: 1 }, hair: { opt: 3 }, shirt: { opt: 0, color: "blue" }, legs: { opt: 1, color: "white" } } },
  { name: "Orc sub", choices: { body: { opt: 2 }, head: { opt: 2 }, hair: null, legs: { opt: 1, color: "navy" } } },
  { name: "Rookie", choices: { body: { opt: 0 }, head: { opt: 1 }, hair: { opt: 1 }, legs: { opt: 1, color: "red" } } },
];
