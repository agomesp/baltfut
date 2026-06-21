/**
 * CORS helpers for the cast-vote Edge Function. Secure-first: we echo an origin
 * back ONLY if it is on the explicit allow-list (no blanket "*" unless opted in
 * via the ALLOWED_ORIGINS env). Pure functions, unit-tested in Node.
 */

/** Parse a comma-separated ALLOWED_ORIGINS env value into a clean list. */
export function parseAllowedOrigins(env: string | undefined): string[] {
  return (env ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Decide which value to send in Access-Control-Allow-Origin:
 *   - "*" if the allow-list explicitly contains "*"
 *   - the request origin if it is allow-listed
 *   - null otherwise (caller should refuse cross-origin requests)
 */
export function resolveAllowedOrigin(
  requestOrigin: string | null,
  allowed: string[],
): string | null {
  if (allowed.includes("*")) return "*";
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return null;
}

/** Build the CORS response headers; allow-origin is set only when resolved. */
export function buildCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      "authorization, x-client-info, apikey, content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
  if (origin) headers["access-control-allow-origin"] = origin;
  return headers;
}
