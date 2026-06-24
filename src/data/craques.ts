/**
 * Per-team "craque" (star player) cutouts for the AO VIVO hero.
 *
 * Maps a FIFA 3-letter code to an ordered squad list; the hero renders the first
 * entry whose image loads and otherwise falls back to the waving-flag crest
 * (so a missing PNG degrades gracefully — see HeroFx in src/components/live-view).
 *
 * Images are SELF-HOSTED transparent PNGs under public/players/<code>/<slug>.png.
 * Sourcing + the (important) licensing caveat — the renders are EA Sports /
 * FUTBIN intellectual property — live in docs/player-images-spike.md.
 *
 * Add a player: drop the cutout under public/players/<code>/, then add an entry
 * here. Helper: `scripts/players/fetch-cutout.sh <futbin-url> <code>/<slug>.png`.
 */
export interface CraquePlayer {
  /** Display name — informational; the hero renders the image, not the name. */
  name: string;
  /** Path under public/players/, e.g. "eng/bellingham.png". */
  img: string;
}

/**
 * Seeded star picks. Only ENG ships a committed image in this spike (a generated
 * placeholder silhouette — NOT scraped art); FRA/BRA/ARG show the map shape and
 * the graceful-fallback path: until their PNG is added, the hero hides the
 * cutout and shows the flag crest.
 */
export const CRAQUES: Record<string, CraquePlayer[]> = {
  ENG: [{ name: "Jude Bellingham", img: "eng/bellingham.png" }],
  FRA: [{ name: "Kylian Mbappé", img: "fra/mbappe.png" }],
  BRA: [{ name: "Vinícius Júnior", img: "bra/vinicius.png" }],
  ARG: [{ name: "Lionel Messi", img: "arg/messi.png" }],
};
