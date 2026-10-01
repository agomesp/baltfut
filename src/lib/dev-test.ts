"use client";

// ⚑ LOCAL-ONLY (do not commit) — shared dev-preview flag, so the popover sets it
// and the live view reads it to render the test1/test2/test3 redesign in place.
import { useEffect, useState } from "react";

export type DevTest = "test1" | "test2" | "test3" | "live" | "prepen" | null;
const KEY = "baltfut_devtest";
const EVENT = "baltfut:devtest";
const VALID = new Set(["test1", "test2", "test3", "live", "prepen"]);

export function getDevTest(): DevTest {
  try {
    const v = localStorage.getItem(KEY);
    return v && VALID.has(v) ? (v as DevTest) : null;
  } catch {
    return null;
  }
}

export function setDevTest(t: DevTest): void {
  try {
    if (t) localStorage.setItem(KEY, t);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function useDevTest(): DevTest {
  const [t, setT] = useState<DevTest>(null);
  useEffect(() => {
    const read = () => setT(getDevTest());
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);
  return t;
}
