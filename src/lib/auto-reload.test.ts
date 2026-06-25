import { describe, it, expect } from "vitest";
import { shouldAutoReload } from "@/lib/auto-reload";

describe("shouldAutoReload", () => {
  it("reloads only when visible, not typing, and not streaming", () => {
    expect(shouldAutoReload({ typing: false, streaming: false, hidden: false })).toBe(true);
  });

  it("never force-reloads during a live broadcast (Modo Streamer)", () => {
    expect(shouldAutoReload({ typing: false, streaming: true, hidden: false })).toBe(false);
  });

  it("never reloads while the user is typing a palpite", () => {
    expect(shouldAutoReload({ typing: true, streaming: false, hidden: false })).toBe(false);
  });

  it("never reloads a hidden/occluded tab (would grey an OBS capture)", () => {
    expect(shouldAutoReload({ typing: false, streaming: false, hidden: true })).toBe(false);
  });
});
