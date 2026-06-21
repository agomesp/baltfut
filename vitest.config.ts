import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the tsconfig path aliases so tests import like app code.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(
        new URL("./supabase/functions/_shared", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      // Pure, framework-agnostic helpers shared with Supabase Edge Functions.
      "supabase/functions/**/*.{test,spec}.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}", "supabase/functions/**/*.ts"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "supabase/functions/**/*.{test,spec}.ts",
        // Generated shadcn primitives — not our logic to cover.
        "src/components/ui/**",
      ],
    },
  },
});
