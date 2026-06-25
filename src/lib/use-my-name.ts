"use client";

import { useEffect, useState } from "react";

const KEY = "baltfut_name";
/** Dispatched on `window` when the locked name is set/cleared, so same-tab
 *  readers (useMyName) refresh — the native `storage` event only fires across
 *  tabs, not within the one that made the change. */
export const MY_NAME_EVENT = "baltfut:name";

/** The viewer's locked nickname (localStorage `baltfut_name`), or null. Reactive
 *  to it changing in this tab (MY_NAME_EVENT) and in other tabs (storage) — so a
 *  "VOCÊ" tag lights up across the live palpites + ranking the moment you claim a
 *  name, without prop-drilling it everywhere. */
export function useMyName(): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        setName(localStorage.getItem(KEY));
      } catch {
        /* ignore */
      }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener(MY_NAME_EVENT, read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener(MY_NAME_EVENT, read);
    };
  }, []);
  return name;
}
