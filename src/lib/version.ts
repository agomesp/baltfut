/** Build id baked into this bundle at build time ("dev" locally). */
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

/**
 * Whether the server is serving a newer build than the one this client booted
 * with. Returns false in dev (no baked id) and when the served id is absent, so
 * a freshly-deployed client never falsely flags an update.
 */
export function hasNewVersion(
  ownId: string,
  fetchedId: string | null | undefined,
): boolean {
  if (!fetchedId || ownId === "dev") return false;
  return fetchedId !== ownId;
}
