import { describe, it, expect } from "vitest";
import { hasNewVersion } from "@/lib/version";

describe("hasNewVersion", () => {
  it("is true when the served id differs from ours", () => {
    expect(hasNewVersion("sha-1", "sha-2")).toBe(true);
  });

  it("is false when ids match (no false-positive on a fresh deploy)", () => {
    expect(hasNewVersion("sha-1", "sha-1")).toBe(false);
  });

  it("is false in dev (no build id baked in)", () => {
    expect(hasNewVersion("dev", "sha-2")).toBe(false);
  });

  it("is false when the served id is missing/empty", () => {
    expect(hasNewVersion("sha-1", null)).toBe(false);
    expect(hasNewVersion("sha-1", undefined)).toBe(false);
    expect(hasNewVersion("sha-1", "")).toBe(false);
  });
});
