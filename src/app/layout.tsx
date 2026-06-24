import type { Metadata } from "next";
import {
  Space_Grotesk,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Bricolage_Grotesque,
  Saira_Condensed,
  JetBrains_Mono,
  Archivo,
} from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { UpdateBanner } from "@/components/update-banner";
import { ModoStreamer } from "@/components/modo-streamer";
import { PipView } from "@/components/pip-view";
import { KickChatReactions } from "@/components/kick-chat-reactions";
import { ChatEmotesToggle } from "@/components/chat-emotes-toggle";

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

// BaltFut v3 redesign type system (AO VIVO). Bricolage = display/headings/usernames,
// Saira Condensed = big numerals (scores/countdowns/W–L), JetBrains Mono = labels &
// `// SECTION` markers, Archivo = team-code badges. Kept alongside the originals so
// the not-yet-redesigned views keep their current fonts.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-bric",
});
const saira = Saira_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-saira",
});
const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jb",
});
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "BaltFut - Copa do Mundo 26 · placar ao vivo & palpites",
  description:
    "Placares ao vivo da Copa do Mundo, tabelas dos grupos, jogos, resultados, chaveamento — e palpite o placar das partidas.",
};

// Apply the saved theme before paint to avoid a flash. Dark is the default.
const themeScript = `try{var t=localStorage.getItem('baltfut_theme');document.documentElement.setAttribute('data-theme', t==='light'?'light':'dark');}catch(e){}`;

// Self-heal the GitHub Pages deploy race: a browser may hold a cached index.html
// (max-age=600) that points to JS chunks a new deploy deleted -> 404 -> "this page
// couldn't load". This runs INLINE in index.html (so even stale HTML carries it,
// unlike the in-React handler which never registers if the entry chunk 404s) and,
// on a failed /_next/ chunk load, does a one-shot cache-busted reload to pull fresh
// HTML + chunks. It NEVER reloads while the document is hidden, so it can't blank a
// hidden/occluded OBS capture to grey (mirrors ModoStreamer's last-painted-frame rule).
const chunkGuardScript = `(function(){try{var K='baltfut_chunkreload';function heal(){if(document.hidden)return;var l=0;try{l=+sessionStorage.getItem(K)||0;}catch(e){}if(Date.now()-l<20000)return;try{sessionStorage.setItem(K,String(Date.now()));}catch(e){}try{var u=new URL(location.href);u.searchParams.set('r',String(Date.now()));location.replace(u.toString());}catch(e){location.reload();}}function isChunk(m){return /ChunkLoadError|Loading chunk|Importing a module script failed|dynamically imported module/i.test(m||'');}addEventListener('error',function(e){var t=e&&e.target,s=(t&&(t.src||t.href))||'';if((t&&(t.tagName==='SCRIPT'||t.tagName==='LINK')&&s.indexOf('/_next/')>-1)||isChunk(e&&e.message))heal();},true);addEventListener('unhandledrejection',function(e){var r=e&&e.reason;if(isChunk((r&&r.message)||String(r||'')))heal();});}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      className={`${display.variable} ${body.variable} ${mono.variable} ${flagFont.variable} ${bricolage.variable} ${saira.variable} ${jbMono.variable} ${archivo.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: chunkGuardScript }} />
      </head>
      <body style={{ minHeight: "100vh" }}>
        {children}
        <KickChatReactions />
        <UpdateBanner />
        <div
          style={{
            position: "fixed",
            bottom: 14,
            right: 14,
            zIndex: 60,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <ChatEmotesToggle />
          <PipView />
          <ModoStreamer />
        </div>
      </body>
    </html>
  );
}
