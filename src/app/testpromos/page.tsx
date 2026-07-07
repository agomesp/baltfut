"use client";

// Standalone view of the streamer PromoSpotlight (the same component mounted in
// the live tab's promo mode). Kept as a quick full-screen way to preview it.
import { PromoSpotlight } from "@/components/live/promo-spotlight";

export default function TestPromosPage() {
  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(1200px 700px at 50% -10%, #14311f, #081109 70%)", color: "#eef3ea", padding: "22px 26px 26px", display: "flex" }}>
      <PromoSpotlight />
    </main>
  );
}
