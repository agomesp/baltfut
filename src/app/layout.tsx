import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { UpdateBanner } from "@/components/update-banner";

// Flags-only webfont so country-flag emoji render on Windows/Edge (whose system
// emoji font omits flags, showing the 2-letter code instead). Only flag glyphs
// come from here; everything else falls back to the body font.
const flagFont = localFont({
  src: "./fonts/TwemojiCountryFlags.woff2",
  variable: "--font-flags",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-display",
});
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "BaltFut - Copa do Mundo 26 · placar ao vivo & palpites",
  description:
    "Placares ao vivo da Copa do Mundo, tabelas dos grupos, jogos, resultados, chaveamento — e palpite o placar das partidas.",
};

// Apply the saved theme before paint to avoid a flash. Dark is the default.
const themeScript = `try{var t=localStorage.getItem('baltfut_theme');document.documentElement.setAttribute('data-theme', t==='light'?'light':'dark');}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      className={`${display.variable} ${body.variable} ${mono.variable} ${flagFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body style={{ minHeight: "100vh" }}>
        {children}
        <UpdateBanner />
      </body>
    </html>
  );
}
