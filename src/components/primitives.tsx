import type { CSSProperties } from "react";

export const MONO = "var(--font-mono)";
export const DISPLAY = "var(--font-display)";

export const cardStyle: CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 6,
  background: "var(--surface)",
  overflow: "hidden",
};

/** Pulsing live indicator dot. */
export function PulseDot({
  size = 7,
  color = "var(--signal)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        display: "inline-block",
        flex: "0 0 auto",
        animation: "livePulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

/** Uppercase mono "eyebrow" label. */
export function Eyebrow({
  children,
  color = "var(--ink-2)",
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
