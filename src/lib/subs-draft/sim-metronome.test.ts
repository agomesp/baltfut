// A0.3 — the background metronome (a Web Worker timer that escapes the hidden-tab
// throttle). jsdom has no real Worker, so the SSR/no-Worker guard path runs
// naturally; the singleton + refcount + fan-out contract (which StrictMode's
// double-mount relies on) is checked against a fake Worker.
import { describe, it, expect, vi, afterEach } from "vitest";
import { subscribeMetronome } from "./sim-metronome";

afterEach(() => vi.unstubAllGlobals());

describe("A0.3 — sim-metronome", () => {
  it("no-ops safely when Worker is unavailable (SSR / static export)", () => {
    expect(typeof Worker).toBe("undefined"); // jsdom → the guard path
    const unsub = subscribeMetronome(() => {});
    expect(typeof unsub).toBe("function");
    expect(() => unsub()).not.toThrow(); // must never throw when there is no worker
  });

  it("is a refcounted singleton: one worker, fan-out to all, terminate on last unsub", () => {
    const instances: FakeWorker[] = [];
    class FakeWorker {
      onmessage: ((e: { data: number }) => void) | null = null;
      terminated = false;
      constructor(public url: string) { instances.push(this); }
      terminate() { this.terminated = true; }
      postMessage() {}
      fire() { this.onmessage?.({ data: 0 }); }
    }
    vi.stubGlobal("Worker", FakeWorker);
    const realCreate = (globalThis.URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    const realRevoke = (globalThis.URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
    const revoked = vi.fn();
    (globalThis.URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:metronome";
    (globalThis.URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = revoked;
    try {
      const a = vi.fn();
      const b = vi.fn();
      const ua = subscribeMetronome(a);
      const ub = subscribeMetronome(b);
      expect(instances).toHaveLength(1); // singleton — second subscribe reuses the worker
      instances[0].fire();
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1); // fan-out to every listener
      ua();
      expect(instances[0].terminated).toBe(false); // one listener remains
      ub();
      expect(instances[0].terminated).toBe(true); // last unsub tears the worker down
      expect(revoked).toHaveBeenCalledWith("blob:metronome"); // and revokes the object URL
    } finally {
      (globalThis.URL as unknown as { createObjectURL?: unknown }).createObjectURL = realCreate;
      (globalThis.URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL = realRevoke;
    }
  });
});
