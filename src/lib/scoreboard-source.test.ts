import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the worker primitive: capture the onData callback and hand back a stop spy
// per start, so we can assert ref-counting without real Workers/network.
const h = vi.hoisted(() => {
  const state: { onData: ((j: unknown) => void) | null; stops: Array<() => void> } = {
    onData: null,
    stops: [],
  };
  const startWorker = vi.fn((_url: string, _iv: number, cb: (j: unknown) => void) => {
    state.onData = cb;
    const stop = vi.fn();
    state.stops.push(stop);
    return stop;
  });
  return { state, startWorker };
});

vi.mock("@/lib/scoreboard-worker", () => ({ startScoreboardWorker: h.startWorker }));
// Parse turns { n } into n sentinel matches, so broadcasts are assertable.
vi.mock("@/lib/espn", () => ({
  parseScoreboard: (json: { n: number }) => Array.from({ length: json.n }, (_, i) => ({ id: String(i) })),
  scoreboardUrl: () => "http://espn/scoreboard",
  DEFAULT_LEAGUE: "fifa.world",
  FIFA_WORLD_DATE_RANGE: "x",
}));

async function loadFresh() {
  vi.resetModules(); // fresh singleton state (listeners/stop/last) per test
  return import("@/lib/scoreboard-source");
}

beforeEach(() => {
  h.startWorker.mockClear();
  h.state.onData = null;
  h.state.stops.length = 0;
});

describe("scoreboard-source — shared ref-counted singleton (A2)", () => {
  it("starts ONE worker for many subscribers, stops only on the last unsubscribe", async () => {
    const { subscribeScoreboard } = await loadFresh();
    const unsubA = subscribeScoreboard(vi.fn());
    const unsubB = subscribeScoreboard(vi.fn());
    expect(h.startWorker).toHaveBeenCalledTimes(1); // one shared worker

    unsubA();
    expect(h.state.stops[0]).not.toHaveBeenCalled(); // B still subscribed
    unsubB();
    expect(h.state.stops[0]).toHaveBeenCalledTimes(1); // last out → stop
  });

  it("broadcasts the parsed matches to every subscriber", async () => {
    const { subscribeScoreboard } = await loadFresh();
    const a = vi.fn();
    const b = vi.fn();
    subscribeScoreboard(a);
    subscribeScoreboard(b);
    h.state.onData!({ n: 3 });
    const expected = [{ id: "0" }, { id: "1" }, { id: "2" }];
    expect(a).toHaveBeenCalledWith(expected);
    expect(b).toHaveBeenCalledWith(expected);
  });

  it("ignores empty/failed parses (keeps last good)", async () => {
    const { subscribeScoreboard } = await loadFresh();
    const a = vi.fn();
    subscribeScoreboard(a);
    h.state.onData!({ n: 2 }); // good
    h.state.onData!({ n: 0 }); // empty → ignored
    expect(a).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith([{ id: "0" }, { id: "1" }]);
  });

  it("hands a late subscriber the cached snapshot immediately (no extra worker)", async () => {
    const { subscribeScoreboard } = await loadFresh();
    subscribeScoreboard(vi.fn());
    h.state.onData!({ n: 1 }); // cache it
    const late = vi.fn();
    subscribeScoreboard(late);
    expect(late).toHaveBeenCalledWith([{ id: "0" }]); // got cache synchronously
    expect(h.startWorker).toHaveBeenCalledTimes(1); // still one worker
  });

  it("restarts a fresh worker if everyone leaves then someone re-subscribes", async () => {
    const { subscribeScoreboard } = await loadFresh();
    subscribeScoreboard(vi.fn())(); // subscribe + immediately unsubscribe
    expect(h.state.stops[0]).toHaveBeenCalledTimes(1);
    subscribeScoreboard(vi.fn());
    expect(h.startWorker).toHaveBeenCalledTimes(2);
  });
});
