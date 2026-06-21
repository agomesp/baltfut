import { describe, it, expect } from "vitest";
import {
  parseAllowedOrigins,
  resolveAllowedOrigin,
  buildCorsHeaders,
} from "@shared/cors";

describe("parseAllowedOrigins", () => {
  it("splits, trims, and drops empties", () => {
    expect(parseAllowedOrigins("https://a.com, https://b.com ,")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });
});

describe("resolveAllowedOrigin", () => {
  const allowed = ["https://allan.github.io", "http://localhost:3000"];

  it("echoes an allow-listed origin", () => {
    expect(resolveAllowedOrigin("http://localhost:3000", allowed)).toBe(
      "http://localhost:3000",
    );
  });

  it("returns null for a disallowed origin", () => {
    expect(resolveAllowedOrigin("https://evil.example", allowed)).toBeNull();
  });

  it("supports an explicit wildcard opt-in", () => {
    expect(resolveAllowedOrigin("https://anything", ["*"])).toBe("*");
  });
});

describe("buildCorsHeaders", () => {
  it("sets allow-origin only when an origin is resolved", () => {
    const withOrigin = buildCorsHeaders("http://localhost:3000");
    expect(withOrigin["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(withOrigin["access-control-allow-methods"]).toContain("POST");

    const without = buildCorsHeaders(null);
    expect(without["access-control-allow-origin"]).toBeUndefined();
  });
});
