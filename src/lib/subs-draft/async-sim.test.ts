import { describe, it, expect, vi } from "vitest";
import { computeChunked, yieldToMain, isAbort } from "./async-sim";

describe("computeChunked — time-sliced map (kills the sim freeze, keeps determinism)", () => {
  it("computes every item in input order, identical to a synchronous map", async () => {
    const items = [3, 1, 4, 1, 5, 9, 2, 6];
    const out = await computeChunked(items, (n) => n * n, { batch: 3 });
    expect(out).toEqual(items.map((n) => n * n));
  });

  it("yields between batches — a competing task interleaves before it finishes", async () => {
    const order: string[] = [];
    const p = computeChunked([0, 1, 2, 3], (n) => order.push("i" + n), { batch: 1 }).then(() => order.push("done"));
    // a macrotask queued now (same mechanism) runs AMONG the yields if computeChunked
    // yields; if it ran synchronously, "done" (a microtask) would land before "competing".
    yieldToMain().then(() => order.push("competing"));
    await p;
    expect(order.indexOf("competing")).toBeLessThan(order.indexOf("done"));
  });

  it("reports progress up to the total", async () => {
    const seen: Array<[number, number]> = [];
    await computeChunked([10, 20, 30], (n) => n, { onProgress: (d, t) => seen.push([d, t]) });
    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]]);
  });

  it("throws AbortError immediately for an already-aborted signal (nothing computed)", async () => {
    const c = new AbortController();
    c.abort();
    const fn = vi.fn((n: number) => n);
    await expect(computeChunked([1, 2, 3], fn, { signal: c.signal })).rejects.toSatisfy(isAbort);
    expect(fn).not.toHaveBeenCalled();
  });

  it("aborts mid-run and drops the rest (the caller never commits a partial result)", async () => {
    const c = new AbortController();
    const fn = vi.fn((n: number) => n);
    await expect(
      computeChunked([1, 2, 3, 4, 5], fn, { batch: 1, signal: c.signal, onProgress: (d) => { if (d === 2) c.abort(); } }),
    ).rejects.toSatisfy(isAbort);
    expect(fn).toHaveBeenCalledTimes(2); // items 0 and 1 ran; abort caught before item 2
  });

  it("yieldToMain resolves (event-loop hop)", async () => {
    await expect(yieldToMain()).resolves.toBeUndefined();
  });
});
