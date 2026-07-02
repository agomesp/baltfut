/**
 * RB Store promo feed shared by the slim on-page showcase and the streamer's
 * bigger PiP promo view. `Promo` mirrors the Supabase `promos` table columns.
 */
export interface Promo {
  product: string;
  price: string | null;
  link: string;
  image: string | null;
  store: string | null;
  coupon: string | null;
  /** Discount percentage (e.g. 20 → "-20%"), or null when the deal has none. */
  discount?: number | null;
}

/** Columns selected from the Supabase `promos` table (kept in sync with the RLS grant). */
export const PROMOS_COLUMNS = "product,price,link,image,store,coupon";

/** How many slots the streamer's promo view fills — a full, scrollable list. */
export const PROMOS_TARGET = 50;

const s = (product: string, price: string, store: string, coupon: string | null, discount: number | null): Promo => ({
  product,
  price,
  link: "https://t.me/rbstorenet",
  image: null,
  store,
  coupon,
  discount,
});

/**
 * Placeholder deals so the promo view is populated for local testing and when the
 * live feed is momentarily empty. Real `promos` rows replace these entirely.
 */
export const SAMPLE_PROMOS: Promo[] = [
  s("Echo Dot 5ª geração com Alexa", "R$ 279", "Amazon", "RB10", 30),
  s("Fire TV Stick 4K Ultra HD", "R$ 249", "Amazon", null, 25),
  s("Kindle 11ª geração 16GB", "R$ 449", "Amazon", "RBKINDLE", 15),
  s("Smart TV 50\" 4K LED", "R$ 2.199", "Magalu", null, 40),
  s("Fone JBL Tune 520BT", "R$ 199", "Mercado Livre", "JBL15", 35),
  s("Cadeira Gamer ThunderX3", "R$ 899", "KaBuM!", null, 20),
  s("SSD NVMe 1TB Kingston", "R$ 389", "KaBuM!", "SSD1TB", 45),
  s("Teclado Mecânico RGB", "R$ 259", "AliExpress", null, 18),
  s("Mouse sem fio Logitech M170", "R$ 59", "Amazon", null, 12),
  s("Power Bank 20000mAh", "R$ 129", "Shopee", "PWR20", 28),
  s("Cafeteira Nespresso Inissia", "R$ 399", "Magalu", null, 22),
  s("Air Fryer 4L Mondial", "R$ 289", "Casas Bahia", "FRY20", 33),
  s("Webcam Full HD 1080p", "R$ 149", "Mercado Livre", null, 16),
  s("Monitor 24\" 144Hz", "R$ 749", "KaBuM!", "MON144", 26),
  s("Camisa Seleção 2026 (torcedor)", "R$ 249", "Netshoes", "COPA26", 50),
  s("Bola Copa do Mundo oficial", "R$ 379", "Centauro", null, 10),
];

/** Local dev fixture written by `scripts/telegram-pull.mjs` — real RB Store deals
 *  the client reads when Supabase isn't configured (no local creds). */
export const PROMOS_FIXTURE = "/promos.json";

/** Extract `Promo[]` from the telegram-pull fixture (`{ items: [...] }`), keeping
 *  only rows with a product + link. Tolerant of missing/extra fields. */
export function parsePromoFixture(json: unknown): Promo[] {
  const items = (json as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  const str = (v: unknown) => (v == null ? null : String(v));
  return items
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
    .map((i) => {
      const d = Number(i.discount);
      return {
        product: String(i.product ?? ""),
        price: str(i.price),
        link: String(i.link ?? ""),
        image: str(i.image),
        store: str(i.store),
        coupon: str(i.coupon),
        discount: Number.isFinite(d) && d > 0 ? Math.round(d) : null,
      };
    })
    .filter((p) => p.product && p.link);
}

/** Only http(s) links reach an href — the PiP renders promo cards via innerHTML. */
export function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : "#";
}

/**
 * LOCAL-DEMO ONLY: fill a deterministic discount on promos that have none, so the
 * offer tag shows on every card when testing with the telegram fixture (real
 * product deals rarely carry an explicit %). Never applied to the live Supabase
 * feed — prod shows a tag only for deals with a real discount.
 */
export function fillDemoDiscounts(promos: Promo[]): Promo[] {
  const buckets = [10, 15, 20, 25, 30, 35, 40, 45];
  return promos.map((p) => {
    if (p.discount != null) return p;
    let h = 0;
    for (let i = 0; i < p.link.length; i++) h = (h * 31 + p.link.charCodeAt(i)) | 0;
    return { ...p, discount: buckets[Math.abs(h) % buckets.length] };
  });
}

/**
 * Exactly `count` promos: the real feed first, cycled to fill the list; the sample
 * deals stand in when the feed is empty. Keeps the streamer view a full, scrollable
 * set regardless of how many live deals exist.
 */
export function padPromos(real: Promo[], count: number): Promo[] {
  if (count <= 0) return [];
  const base = real.length ? real : SAMPLE_PROMOS;
  return Array.from({ length: count }, (_, i) => base[i % base.length]);
}
