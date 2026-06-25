"use client";

import { useEffect, useState } from "react";

/**
 * True when the viewport is at most `maxWidth` px wide — the signal the live
 * dashboard uses to collapse its multi-column stages into a single mobile stack.
 *
 * Resize-listener based (not matchMedia) to mirror the existing window-width read
 * in `live-view`. The lazy initializer reads the real width on the client so
 * mobile renders correct on the first paint (no desktop→mobile flash); on the
 * server it yields `false`. Every consumer renders only AFTER the post-mount data
 * load (behind the page's `loading` gate), so this never runs during hydration —
 * no SSR markup mismatch.
 */
export function useIsNarrow(maxWidth = 768): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= maxWidth,
  );
  useEffect(() => {
    const apply = () => setNarrow(window.innerWidth <= maxWidth);
    apply(); // re-sync in case the width changed between init and mount
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [maxWidth]);
  return narrow;
}
