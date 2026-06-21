/**
 * Client-IP helpers for the cast-vote Edge Function. Pure + Web-Crypto only, so
 * they run identically in Deno (production) and Node (Vitest).
 *
 * IMPORTANT: the IP must be derived SERVER-SIDE. A static page cannot be trusted
 * to report its own address, which is why one-vote-per-IP lives in the function.
 */

/** Minimal shape we need from a Headers object (Deno/DOM/undici all satisfy it). */
interface HeaderLike {
  get(name: string): string | null;
}

/**
 * Best-effort client IP from proxy headers. Takes the first x-forwarded-for hop
 * (the client) and falls back to x-real-ip.
 *
 * Caveat (basic tier): a caller could spoof x-forwarded-for. This defeats the
 * casual "refresh and vote again" case the product asked for. The strong tier
 * (Turnstile + a platform-trusted IP source) hardens against deliberate spoofing.
 */
export function getClientIp(headers: HeaderLike): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  return null;
}

/**
 * Salted SHA-256 of an IP, hex-encoded. The pepper is a server-only secret, so
 * the stored hash is neither reversible nor rainbow-table-able, and the raw IP
 * is never persisted.
 */
export async function hashIp(ip: string, pepper: string): Promise<string> {
  const data = new TextEncoder().encode(`${pepper}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
