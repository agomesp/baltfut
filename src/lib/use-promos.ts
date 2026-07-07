"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  fillDemoDiscounts, parsePromoFixture, promosFromRows,
  PROMOS_COLUMNS, PROMOS_FIXTURE, PROMOS_TARGET, SAMPLE_PROMOS, type Promo, type PromoRow,
} from "@/lib/promos";

const POLL_MS = 4 * 60_000;

/**
 * The RB Store promo feed, same source ladder as the Spotlight/panel: Supabase
 * (polled every 4 min) → the telegram fixture (local dev) → the sample deals. Always
 * returns a non-empty list so callers don't special-case an empty feed.
 */
export function usePromos(): Promo[] {
  const [fetched, setFetched] = useState<Promo[]>([]);
  useEffect(() => {
    const client = getSupabaseClient();
    let alive = true;
    const loadSupabase = async () => {
      if (!client) return;
      const { data } = await client.from("promos").select(PROMOS_COLUMNS).order("position").limit(PROMOS_TARGET);
      if (alive && data?.length) setFetched(promosFromRows(data as PromoRow[]));
    };
    const loadFixture = async () => {
      try {
        const res = await fetch(PROMOS_FIXTURE, { cache: "no-store" });
        if (res.ok) { const p = fillDemoDiscounts(parsePromoFixture(await res.json())); if (alive && p.length) setFetched(p); }
      } catch { /* fall back to samples */ }
    };
    if (client) {
      void loadSupabase();
      const id = window.setInterval(() => void loadSupabase(), POLL_MS);
      return () => { alive = false; window.clearInterval(id); };
    }
    void loadFixture();
    return () => { alive = false; };
  }, []);
  return fetched.length ? fetched : SAMPLE_PROMOS;
}
