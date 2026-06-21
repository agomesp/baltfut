// Writes public/version.json with the current build id so already-open clients
// can detect a new deploy (they compare it to the id baked into their bundle).
// Runs as the npm "prebuild" step, before `next build` copies public/ into out/.
import { mkdirSync, writeFileSync } from "node:fs";

const id = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
mkdirSync("public", { recursive: true });
writeFileSync("public/version.json", `${JSON.stringify({ id })}\n`);
console.log(`gen-version: version.json id = ${id}`);
