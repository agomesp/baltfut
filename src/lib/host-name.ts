import { nameSkeleton } from "@shared/name-claim";

// The stream host. His palpites and his Ranking dos Subs row render in the
// RB-brand blue so they read as "official" — the same idea as the ChatGPT
// house-bot's rainbow name, but blue and DISPLAY-ONLY: unlike a reserved name,
// the host must still be able to palpite under his own name, so this never gates
// submission (see isReservedName in @shared/name-claim for the gating one).

/** RB-brand blue — the start of the promo CTA gradient (#3b82f6 → #6366f1). */
export const HOST_NAME_COLOR = "#3b82f6";

// Matched on the confusable skeleton, so it's robust to casing, the spacing/
// separators the username charset allows, and homoglyph look-alikes ("Rodrigo
// BaItar" with a capital-I) — the same normalization that powers name ownership.
const HOST_SKELETON = nameSkeleton("Rodrigo Baltar"); // "rodrigobaltar"

/** Whether `name` is the stream host (Rodrigo Baltar). Display-only. */
export function isHostName(name: string): boolean {
  // Two passes so BOTH casing and the homoglyph spoof resolve to the host:
  //  - raw: folds an upper-case "I" → "l", so "Rodrigo BaItar" matches.
  //  - lower-cased first: an all-caps "RODRIGO BALTAR" would otherwise have the
  //    legitimate "I" in RODRIGO folded to "l" and miss; lower-casing avoids it.
  return (
    nameSkeleton(name) === HOST_SKELETON ||
    nameSkeleton(name.toLowerCase()) === HOST_SKELETON
  );
}
