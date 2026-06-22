// Nickname ownership + normalization. Pure (no Deno/Node globals) so the
// cast-vote Edge Function and the Node unit tests share it. Kept self-contained
// (no intra-_shared imports) so the app's tsc — which forbids .ts-extension
// imports that Deno requires — type-checks it unchanged.

// --- confusable "skeleton" ----------------------------------------------------
// A canonical key that folds visually-identical glyphs to one prototype, so
// look-alike names resolve to the SAME identity and can't be used to impersonate
// an existing owner (e.g. "Rodrigo BaItar" with a capital-I posing as
// "Rodrigo Baltar"). Used only for collision/ownership checks, never shown.

// Folded BEFORE lower-casing — read as 'l'/'o' in their upper/mixed-case form
// (how the attack renders); dotted lower-case 'i' is left alone on purpose.
const PRE_FOLD: Record<string, string> = {
  I: "l", "1": "l", "İ": "l", "Ι": "l" /* Greek Iota */, "І": "l" /* Cyrillic I */, "Ӏ": "l",
  "0": "o",
};
// Folded AFTER lower-casing — cross-script letters that look Latin, plus 'ı'.
const POST_FOLD: Record<string, string> = {
  "ı": "l",
  "о": "o", "ο": "o",
  "а": "a", "е": "e", "р": "p", "с": "c", "у": "y", "х": "x",
  "к": "k", "м": "m", "н": "h", "в": "b", "т": "t", "ѕ": "s",
  "α": "a", "ε": "e", "ρ": "p", "ν": "v", "τ": "t", "κ": "k",
};

/**
 * Canonical skeleton of a nickname: NFKD-normalized, accent- and zero-width-
 * stripped, confusable-folded, lower-cased, separators removed. Two names with
 * the same skeleton are treated as the same identity.
 */
export function nameSkeleton(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // combining accents
    .replace(/[​-‍⁠﻿]/g, "") // zero-width / invisible
    .replace(/./gu, (c) => PRE_FOLD[c] ?? c)
    .toLowerCase()
    .replace(/./gu, (c) => POST_FOLD[c] ?? c)
    .replace(/[\s_.\-]+/g, "")
    .trim();
}

/** A name is reclaimable after this long with no palpite from its owner. */
export const CLAIM_STALE_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Names nobody may palpite under — they belong to the app itself. "ChatGPT" is
 * the house bot whose palpites are seeded server-side; reserving it stops anyone
 * from impersonating it. Stored as skeletons (see {@link isReservedName}).
 */
const RESERVED_SKELETONS = new Set(["chatgpt"]);

/**
 * Whether `name` is reserved for the app. Compared on the confusable skeleton, so
 * it's robust not only to casing and the spacing/separators the username charset
 * allows ("Chat GPT", "chat.gpt"…) but also to homoglyph spoofing ("ChatGPT" with
 * a capital-I, a Cyrillic look-alike, etc.).
 */
export function isReservedName(name: string): boolean {
  return RESERVED_SKELETONS.has(nameSkeleton(name));
}

export interface NameClaim {
  token_hash: string;
  last_used_at: string; // ISO timestamp
}

/**
 * Decide whether the caller (identified by `myTokenHash`) may palpite under a
 * name, given the existing claim (or null if unclaimed):
 *   - unclaimed                  -> "ok" (caller claims it)
 *   - claimed by the same token  -> "ok" (the owner)
 *   - claimed by another token,
 *       but stale (>24h idle)    -> "ok" (caller takes it over)
 *   - claimed by another token,
 *       still fresh              -> "taken" (reject — someone else owns it)
 */
export function decideClaim(
  existing: NameClaim | null,
  myTokenHash: string,
  now: number,
  staleMs = CLAIM_STALE_MS,
): "ok" | "taken" {
  if (!existing) return "ok";
  if (existing.token_hash === myTokenHash) return "ok";
  const last = Date.parse(existing.last_used_at);
  if (!Number.isNaN(last) && now - last > staleMs) return "ok";
  return "taken";
}
