"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Ticks once a second and renders the remaining ms via `render`. */
export function Countdown({
  targetMs,
  render,
}: {
  targetMs: number;
  render: (remainingMs: number) => ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{render(targetMs - now)}</>;
}
