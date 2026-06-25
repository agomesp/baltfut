import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useIsNarrow } from "./use-is-narrow";

function setWidth(w: number) {
  (window as { innerWidth: number }).innerWidth = w;
  window.dispatchEvent(new Event("resize"));
}

describe("useIsNarrow", () => {
  afterEach(() => setWidth(1024)); // jsdom default

  it("is false on a wide viewport", () => {
    setWidth(1280);
    const { result } = renderHook(() => useIsNarrow(768));
    expect(result.current).toBe(false);
  });

  it("is true at or below the breakpoint", () => {
    setWidth(375);
    const { result } = renderHook(() => useIsNarrow(768));
    expect(result.current).toBe(true);
  });

  it("treats the breakpoint itself as narrow (<=)", () => {
    setWidth(768);
    const { result } = renderHook(() => useIsNarrow(768));
    expect(result.current).toBe(true);
  });

  it("reacts to a resize across the breakpoint", () => {
    setWidth(1200);
    const { result } = renderHook(() => useIsNarrow(768));
    expect(result.current).toBe(false);
    act(() => setWidth(500));
    expect(result.current).toBe(true);
    act(() => setWidth(900));
    expect(result.current).toBe(false);
  });

  it("defaults to a 768px breakpoint", () => {
    setWidth(700);
    const { result } = renderHook(() => useIsNarrow());
    expect(result.current).toBe(true);
  });
});
