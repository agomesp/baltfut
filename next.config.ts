import type { NextConfig } from "next";

/**
 * Static-export config for GitHub Pages.
 *
 * The whole app is exported to `out/` as plain HTML/CSS/JS — there is no Node
 * server in production. All dynamic data is fetched client-side:
 *   - live scores  -> ESPN public API (keyless, CORS-open)
 *   - vote results -> Supabase read-only views (anon key)
 *   - casting votes -> Supabase Edge Function (server-side IP check)
 *
 * GitHub Pages *project* sites are served from https://<user>.github.io/<repo>,
 * so assets must be prefixed with `/<repo>`. Set NEXT_PUBLIC_BASE_PATH="/<repo>"
 * in CI. Leave it empty for local dev, a custom domain, or a user/org page.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  // GitHub Pages cannot run the Next.js image optimizer.
  images: { unoptimized: true },
  basePath: basePath || undefined,
  // Serve `/path/` -> `/path/index.html`, which is how Pages resolves dirs.
  trailingSlash: true,
  // Note: `next build` type-checks by default (a type error fails the build).
  // ESLint is run as its own CI step — Next 16 no longer lints during build.
};

export default nextConfig;
