import { describe, it, expect } from "vitest";
import { isHostName, HOST_NAME_COLOR } from "@/lib/host-name";

describe("isHostName — stream host (Rodrigo Baltar)", () => {
  it("matches the canonical name regardless of casing", () => {
    expect(isHostName("Rodrigo Baltar")).toBe(true);
    expect(isHostName("rodrigo baltar")).toBe(true);
    expect(isHostName("RODRIGO BALTAR")).toBe(true);
  });

  it("matches across the spacing/separators the username charset allows", () => {
    expect(isHostName("Rodrigo  Baltar")).toBe(true);
    expect(isHostName("Rodrigo.Baltar")).toBe(true);
    expect(isHostName("Rodrigo_Baltar")).toBe(true);
    expect(isHostName("Rodrigo-Baltar")).toBe(true);
    expect(isHostName("  Rodrigo Baltar  ")).toBe(true);
  });

  it("matches the homoglyph spoof (capital-I posing as lowercase-l)", () => {
    // The exact impersonation that hit the ranking once: "Rodrigo BaItar".
    expect(isHostName("Rodrigo BaItar")).toBe(true);
  });

  it("does not match other names, partials, or the house bot", () => {
    expect(isHostName("ChatGPT")).toBe(false);
    expect(isHostName("Rodrigo")).toBe(false);
    expect(isHostName("Baltar")).toBe(false);
    expect(isHostName("Rodrigo Baltarzinho")).toBe(false);
    expect(isHostName("")).toBe(false);
  });
});

describe("HOST_NAME_COLOR", () => {
  it("is the RB-brand blue from the promo CTA gradient", () => {
    expect(HOST_NAME_COLOR).toBe("#3b82f6");
  });
});
