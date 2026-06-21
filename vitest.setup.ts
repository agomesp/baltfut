// Extends Vitest's `expect` with jest-dom matchers (toBeInTheDocument, etc.)
// and augments the matcher types for TypeScript.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// We don't enable Vitest `globals`, so RTL's automatic cleanup (which hooks an
// `afterEach` global) won't run on its own — wire it up explicitly.
afterEach(() => {
  cleanup();
});
