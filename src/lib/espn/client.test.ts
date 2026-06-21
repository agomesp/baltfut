import { describe, it, expect, vi } from "vitest";
import {
  fetchScoreboard,
  scoreboardUrl,
  DEFAULT_LEAGUE,
} from "@/lib/espn/client";
import fixture from "@/lib/espn/__fixtures__/scoreboard.json";

function okResponse(body: unknown) {
  return { ok: true, status: 200, statusText: "OK", json: async () => body };
}

describe("scoreboardUrl", () => {
  it("targets the ESPN soccer scoreboard for a league", () => {
    expect(scoreboardUrl("fifa.world")).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard",
    );
  });

  it("encodes the league to prevent path injection", () => {
    expect(scoreboardUrl("../../secret")).not.toContain("../");
  });

  it("appends a dates range when provided", () => {
    expect(scoreboardUrl("fifa.world", "20260611-20260719")).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719",
    );
  });
});

describe("fetchScoreboard", () => {
  it("defaults to the FIFA World Cup league and returns parsed matches", async () => {
    const fakeFetch = vi.fn(async (_url: string, _init?: RequestInit) =>
      okResponse(fixture),
    );
    const matches = await fetchScoreboard({
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    expect(fakeFetch).toHaveBeenCalledOnce();
    expect(String(fakeFetch.mock.calls[0][0])).toContain(
      `/${DEFAULT_LEAGUE}/scoreboard`,
    );
    expect(matches.map((m) => m.id)).toEqual(["1001", "1002", "1003"]);
  });

  it("throws when ESPN responds with a non-OK status", async () => {
    const fakeFetch = vi.fn(async () => ({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({}),
    }));
    await expect(
      fetchScoreboard({ fetchImpl: fakeFetch as unknown as typeof fetch }),
    ).rejects.toThrow(/503/);
  });

  it("forwards an abort signal to fetch", async () => {
    const controller = new AbortController();
    const fakeFetch = vi.fn(async (_url: string, _init?: RequestInit) =>
      okResponse(fixture),
    );
    await fetchScoreboard({
      fetchImpl: fakeFetch as unknown as typeof fetch,
      signal: controller.signal,
    });
    const init = fakeFetch.mock.calls[0][1] as RequestInit | undefined;
    expect(init?.signal).toBe(controller.signal);
  });
});
