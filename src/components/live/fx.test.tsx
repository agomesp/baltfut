import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RollingNumber, SlamOnChange, IdleFloat, beatTrack, BAR_SECONDS, STOMP_1, STOMP_2, CLAP } from "@/components/live/fx";

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

describe("the We Will Rock You beat", () => {
  it("runs one bar of 4/4 at 81 BPM", () => {
    // stomp, stomp, clap, rest — the rest is what makes it the right song.
    expect(BAR_SECONDS).toBeCloseTo(2.963, 2);
  });

  it("puts the stomps on beats 1 and 2 and the clap on beat 3", () => {
    expect([STOMP_1, STOMP_2, CLAP]).toEqual([0, 0.25, 0.5]);
  });

  it("punches on the beat instead of ramping into it", () => {
    const { times, values } = beatTrack([STOMP_2], 0.05, 0.42);
    const hit = times.indexOf(STOMP_2);
    expect(hit).toBeGreaterThan(0);
    // The frame immediately before the beat is still at rest, so the rise is
    // ~35ms — percussive. Interpolating from 0 would read as a sine swell.
    expect(values[hit - 1]).toBe(0.05);
    expect(values[hit]).toBe(0.42);
    expect(times[hit] - times[hit - 1]).toBeLessThan(0.02);
  });

  it("emits a valid keyframe track: starts at 0, ends at 1, strictly increasing", () => {
    for (const hits of [[STOMP_1, CLAP], [STOMP_2, CLAP]]) {
      const { times, values } = beatTrack(hits, 0.05, 0.42);
      expect(times[0]).toBe(0);
      expect(times[times.length - 1]).toBe(1);
      expect(times.length).toBe(values.length);
      for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });

  it("ends each bar at rest, so the loop seam is silence not a held note", () => {
    const { values } = beatTrack([STOMP_1, CLAP], 0.05, 0.42);
    expect(values[values.length - 1]).toBe(0.05);
  });
});
