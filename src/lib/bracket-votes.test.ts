import { describe, it, expect, vi } from "vitest";
import { submitBracket, mapBracketRow, type CastBracketTransport } from "@/lib/bracket-votes";

const valid = { username: "Ana", picks: { "0-0": "BRA", "4-0": "BRA" } };

describe("submitBracket", () => {
  it("rejects an invalid payload locally without calling the transport", async () => {
    const transport = vi.fn<CastBracketTransport>();
    const r = await submitBracket({ username: "a", picks: {} }, transport);
    expect(r.ok).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });

  it("succeeds on a 201", async () => {
    const transport = vi.fn<CastBracketTransport>().mockResolvedValue({ status: 201, body: { ok: true } });
    expect(await submitBracket(valid, transport)).toEqual({ ok: true });
    expect(transport).toHaveBeenCalledOnce();
  });

  it("surfaces the server error message on a 403 (name taken / reserved)", async () => {
    const transport = vi.fn<CastBracketTransport>().mockResolvedValue({ status: 403, body: { error: "Esse nome pertence a outra pessoa. Escolha outro." } });
    const r = await submitBracket(valid, transport);
    expect(r).toMatchObject({ ok: false, status: 403, message: /outra pessoa/ });
  });

  it("reports a network error when the transport throws", async () => {
    const transport = vi.fn<CastBracketTransport>().mockRejectedValue(new Error("boom"));
    const r = await submitBracket(valid, transport);
    expect(r).toMatchObject({ ok: false, message: /rede/ });
  });
});

describe("mapBracketRow", () => {
  it("maps snake_case → camelCase and defaults null picks to {}", () => {
    expect(mapBracketRow({ username: "Ana", picks: { "0-0": "BRA" }, updated_at: "2026-07-03T00:00:00Z" }))
      .toEqual({ username: "Ana", picks: { "0-0": "BRA" }, updatedAt: "2026-07-03T00:00:00Z" });
    expect(mapBracketRow({ username: "X", picks: null, updated_at: "t" }).picks).toEqual({});
  });
});
