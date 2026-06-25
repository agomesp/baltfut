"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Custom fallback; defaults to a branded reload card. */
  fallback?: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Catches a render/lifecycle crash anywhere below it and shows a fallback instead
 * of letting React unmount the whole tree to a blank white screen. Critical for a
 * broadcast: without this, a single component throw (e.g. the craque cinematic on
 * unexpected data) would blank the entire stream with no recovery.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    // Surface it — never swallow a crash silently.
    console.error("[ErrorBoundary] caught a render crash:", error);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return this.props.fallback ?? <DefaultFallback />;
    }
    return this.props.children;
  }
}

function DefaultFallback() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-bric)", fontWeight: 800, fontSize: 22, color: "#cfd9d1" }}>Ops, algo travou</div>
      <div style={{ fontSize: 14, color: "#6f8a78", maxWidth: 320 }}>Tivemos um erro ao desenhar a tela. Use o botão para voltar ao ao vivo.</div>
      <button
        onClick={() => window.location.reload()}
        style={{ fontFamily: "var(--font-jb)", fontSize: 13, fontWeight: 700, background: "#c8ff2d", color: "#0f1f02", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer" }}
      >
        Recarregar
      </button>
    </div>
  );
}
