import { describe, it, expect } from "vitest";
import { getClientIp, hashIp } from "@shared/ip";

describe("getClientIp", () => {
  it("takes the first entry of x-forwarded-for and trims it", () => {
    const h = new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1 " });
    expect(getClientIp(h)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "198.51.100.4" });
    expect(getClientIp(h)).toBe("198.51.100.4");
  });

  it("returns null when no IP header is present", () => {
    expect(getClientIp(new Headers())).toBeNull();
  });
});

describe("hashIp", () => {
  it("produces a 64-char hex SHA-256 digest", async () => {
    const hash = await hashIp("203.0.113.7", "pepper");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same ip + pepper", async () => {
    const a = await hashIp("203.0.113.7", "pepper");
    const b = await hashIp("203.0.113.7", "pepper");
    expect(a).toBe(b);
  });

  it("never returns the raw IP and changes with ip or pepper", async () => {
    const base = await hashIp("203.0.113.7", "pepper");
    expect(base).not.toContain("203.0.113.7");
    expect(base).not.toBe(await hashIp("203.0.113.8", "pepper"));
    expect(base).not.toBe(await hashIp("203.0.113.7", "different-pepper"));
  });
});
