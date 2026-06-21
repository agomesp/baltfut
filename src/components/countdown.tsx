"use client";

import { type ReactNode } from "react";
import { useNow } from "@/lib/use-now";

/** Ticks once a second and renders the remaining ms via `render`. */
export function Countdown({
  targetMs,
  render,
}: {
  targetMs: number;
  render: (remainingMs: number) => ReactNode;
}) {
  const now = useNow(1000);
  return <>{render(targetMs - now)}</>;
}
