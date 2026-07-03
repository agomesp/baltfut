/**
 * A stable per-browser secret that proves nickname ownership to the Edge
 * Functions. Generated once and kept in localStorage; sent (never displayed)
 * with each palpite AND each bracket, so both write under one identity. Falls
 * back to an ephemeral token if storage is unavailable.
 */
export function ownerToken(): string {
  try {
    let t = localStorage.getItem("baltfut_token");
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem("baltfut_token", t);
    }
    return t;
  } catch {
    return crypto.randomUUID();
  }
}
