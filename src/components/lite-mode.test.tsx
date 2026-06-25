import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { LiteMode } from "@/components/lite-mode";
import { setStreamerMode } from "@/lib/streamer-mode";

afterEach(() => {
  cleanup();
  setStreamerMode(false);
});

describe("LiteMode", () => {
  it("toggles <html data-lite> in lockstep with Modo Streamer", () => {
    render(<LiteMode />);
    expect(document.documentElement.hasAttribute("data-lite")).toBe(false);

    act(() => setStreamerMode(true));
    expect(document.documentElement.hasAttribute("data-lite")).toBe(true);

    act(() => setStreamerMode(false));
    expect(document.documentElement.hasAttribute("data-lite")).toBe(false);
  });
});
