import { describe, expect, it } from "vitest";
import { fillDemoDiscounts, padPromos, parsePromoFixture, safeUrl, SAMPLE_PROMOS, type Promo } from "@/lib/promos";

const p = (product: string): Promo => ({
  product, price: null, link: "https://x", image: null, store: null, coupon: null,
});

describe("padPromos", () => {
  it("fills to exactly the requested count from the sample deals when empty", () => {
    const out = padPromos([], 50);
    expect(out).toHaveLength(50);
    expect(out.every((x) => SAMPLE_PROMOS.includes(x))).toBe(true);
  });

  it("cycles the real feed to fill the list", () => {
    const [a, b, c] = [p("a"), p("b"), p("c")];
    expect(padPromos([a, b, c], 5)).toEqual([a, b, c, a, b]);
  });

  it("returns the real feed as-is when it already meets the count", () => {
    const real = [p("a"), p("b")];
    expect(padPromos(real, 2)).toEqual(real);
  });

  it("returns an empty list for a non-positive count", () => {
    expect(padPromos([p("a")], 0)).toEqual([]);
  });
});

describe("parsePromoFixture", () => {
  it("maps the telegram-pull fixture to promos, dropping rows without a product+link", () => {
    const json = {
      items: [
        { position: 0, product: "RTX 5070", price: "R$ 3.846", link: "https://rbstore.net/s/x", image: "https://cdn/i.jpg", store: "Amazon", coupon: "RB10", discount: 20, date: "2026-07-02" },
        { position: 1, product: "No link", price: "R$ 1", link: "", image: null, store: null, coupon: null },
        { position: 2, price: "R$ 2", link: "https://rbstore.net/s/y" }, // no product
      ],
    };
    const out = parsePromoFixture(json);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ product: "RTX 5070", price: "R$ 3.846", link: "https://rbstore.net/s/x", image: "https://cdn/i.jpg", store: "Amazon", coupon: "RB10", discount: 20 });
  });

  it("defaults discount to null when absent or non-positive", () => {
    const json = { items: [{ product: "X", link: "https://a", discount: 0 }, { product: "Y", link: "https://b" }] };
    expect(parsePromoFixture(json).map((p) => p.discount)).toEqual([null, null]);
  });

  it("returns an empty list for a malformed fixture", () => {
    expect(parsePromoFixture(null)).toEqual([]);
    expect(parsePromoFixture({})).toEqual([]);
    expect(parsePromoFixture({ items: "nope" })).toEqual([]);
  });
});

describe("fillDemoDiscounts", () => {
  const base = (link: string, discount: number | null = null): Promo => ({
    product: "p", price: null, link, image: null, store: null, coupon: null, discount,
  });

  it("keeps an existing discount and fills a deterministic one when missing", () => {
    const [withReal, filledA, filledB] = fillDemoDiscounts([base("x", 30), base("y"), base("y")]);
    expect(withReal.discount).toBe(30);
    expect(filledA.discount).toBeGreaterThan(0);
    expect(filledB.discount).toBe(filledA.discount); // deterministic by link
  });
});

describe("safeUrl", () => {
  it("passes http(s) links through", () => {
    expect(safeUrl("https://t.me/rbstorenet")).toBe("https://t.me/rbstorenet");
    expect(safeUrl("http://example.com")).toBe("http://example.com");
  });

  it("blocks non-http schemes (renders via innerHTML)", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("data:text/html,x")).toBe("#");
    expect(safeUrl("")).toBe("#");
  });
});
