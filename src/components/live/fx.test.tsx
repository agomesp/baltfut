import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RollingNumber, SlamOnChange, IdleFloat } from "@/components/live/fx";

/**
 * These lock ONE property, and it is the one that matters: when the document is
 * hidden the effects must collapse to plain markup.
 *
 * A hidden tab stops firing rAF, which strands in-flight animations. That turned
 * a rolling "28%" into a smear of stacked ghost digits and left an entrance at
 * opacity 0 — on a screen whose whole job is being broadcast while nobody is
 * looking at the browser. Static-when-hidden is the guarantee that makes the
 * effects safe to run at all.
 */

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => setHidden(false));

describe("motion primitives while the tab is hidden", () => {
  it("RollingNumber renders the number as plain text, with no stacked glyphs", () => {
    setHidden(true);
    const { container } = render(<RollingNumber value="28" />);
    // Exactly one node carrying the text — not one span per character, which is
    // what strands ghosts when the animation can't finish.
    expect(container.textContent).toBe("28");
    expect(container.querySelectorAll("span").length).toBe(1);
  });

  it("SlamOnChange renders its children rather than an un-settled transform", () => {
    setHidden(true);
    render(<SlamOnChange trigger={2}>PLACAR</SlamOnChange>);
    expect(screen.getByText("PLACAR")).toBeInTheDocument();
  });

  it("IdleFloat renders its children", () => {
    setHidden(true);
    const { container } = render(<IdleFloat>crest</IdleFloat>);
    expect(container.textContent).toBe("crest");
  });

  it("RollingNumber still shows the full value when visible", () => {
    setHidden(false);
    const { container } = render(<RollingNumber value="28" />);
    // Animated form splits per glyph, but the reading must be unchanged.
    expect(container.textContent).toBe("28");
  });
});
