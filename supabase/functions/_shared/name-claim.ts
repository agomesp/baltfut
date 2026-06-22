// Nickname ownership decision. Pure (no Deno/Node globals) so the cast-vote
// Edge Function and the Node unit tests share it.

/** A name is reclaimable after this long with no palpite from its owner. */
export const CLAIM_STALE_MS = 24 * 60 * 60 * 1000; // 24h

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
