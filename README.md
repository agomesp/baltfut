# baltfut — Copa do Mundo 26

A fast, **static** companion app for the 2026 FIFA World Cup, in Brazilian
Portuguese. Live scores, fixtures, group standings, results, and a schematic
knockout bracket — plus a community **score-prediction** game. Hosted on GitHub
Pages; data from ESPN; predictions stored in Supabase. No login.

Five tabs: **Ao vivo** (live + predictions + lineups), **Jogos** (fixtures),
**Grupos** (standings), **Resultados** (results), **Chaveamento** (bracket).
Dark/light theme and a persistent "follow team" highlight.

## Architecture

```
 Browser (static site on GitHub Pages, pt-BR)
   │
   ├── scores / fixtures / results ─►  ESPN scoreboard?dates=… (one ranged call, keyless, CORS-open)
   ├── group standings ─────────────►  ESPN standings
   ├── lineups (selected match) ────►  ESPN summary?event=…
   ├── read predictions ────────────►  Supabase vote_entries view (anon, RLS)
   └── submit a prediction ─────────►  Supabase Edge Function "cast-vote"
                                          validates (shared zod) · hashes client IP server-side
                                          inserts via service_role → votes  (UNIQUE(match_id, ip_hash))
```

- **Frontend:** Next.js 16 (App Router, static export), React 19, the "Allan
  Gomes" design system (graphite/paper + green accent, Space Grotesk + IBM Plex).
- **Backend:** Supabase Postgres (RLS) + one Deno Edge Function.
- **Predictions:** name + predicted scoreline, one per IP per match; ranked live
  as winning / can-win / losing against the real score (client-side).
- **Security:** see [SECURITY.md](SECURITY.md). RLS locks the DB, the anon key is
  public by design, service_role never leaves the server, the only write path is
  the Edge Function.

## Prerequisites

- **Node 22** (toolchain needs ≥18.18); pinned via `.nvmrc` → run `nvm use`.
- Docker (only for the local Supabase stack / DB tests).
- Supabase CLI is bundled (`npx supabase …`).

## Setup

```sh
nvm use
npm ci
cp .env.example .env.local   # optional: NEXT_PUBLIC_SUPABASE_* enables predictions
npm run dev                  # http://localhost:3000
```

Without Supabase env the site still runs — scores/standings/etc. work; only the
prediction form is inert.

## Scripts

| Command | What |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Static export to `out/` |
| `npm test` | Vitest (parsers, formatting, prediction logic, components) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (CI runs `--max-warnings 0`) |

## Data & deployment

- ESPN league defaults to `fifa.world`; the tournament window is fetched as a
  date range (`src/lib/espn/client.ts`).
- **Frontend → GitHub Pages** and **backend → Supabase** via the workflows in
  `.github/workflows/` (see [SECURITY.md](SECURITY.md) and each workflow header
  for required secrets). RLS is asserted in CI against a real Postgres
  ([scripts/db](scripts/db)).
