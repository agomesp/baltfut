# baltfut

Live soccer scores with community predictions. A **static** Next.js site (hosted
on GitHub Pages) that pulls live matches from ESPN and lets anyone vote their
preferred team and predicted score. Votes are stored in Supabase, one per IP per
match — no login required.

## Architecture

```
 Browser (static site on GitHub Pages)
   │
   ├── GET live scores ──────────────►  ESPN site API (keyless, CORS-open)
   │
   ├── GET vote aggregates ──────────►  Supabase: vote_results / vote_entries views (anon, RLS)
   │
   └── POST a vote ──────────────────►  Supabase Edge Function "cast-vote"
                                          │ validates (shared zod schema)
                                          │ hashes client IP (salted, server-side)
                                          └─ inserts via service_role  →  votes table
                                             UNIQUE(match_id, ip_hash) = one vote / IP / match
```

- **Frontend:** Next.js 16 (App Router, static export), React 19, Tailwind v4,
  shadcn/ui (Base UI).
- **Backend:** Supabase Postgres (RLS) + one Deno Edge Function.
- **Security:** see [SECURITY.md](SECURITY.md). Short version: RLS locks the DB,
  the anon key is public by design, the service_role key never leaves the server,
  and the only write path is the Edge Function.

## Prerequisites

- **Node 22** (the toolchain needs ≥18.18). The repo pins it via `.nvmrc`:
  ```sh
  nvm use      # -> Node 22
  ```
- Docker (only for the local Supabase stack / DB tests).
- Supabase CLI is bundled as a dev dependency (`npx supabase ...`).

## Setup

```sh
nvm use
npm ci
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_* (optional for scores-only)
npm run dev                  # http://localhost:3000
```

Without Supabase env the site still runs — live scores show, voting is hidden.

## Scripts

| Command | What |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Static export to `out/` |
| `npm test` | Vitest (unit + component) |
| `npm run test:watch` | Vitest watch |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (CI runs `--max-warnings 0`) |

## Database & Edge Function (local)

```sh
npx supabase start                 # local stack (Docker)
npx supabase db reset              # apply migrations
npx supabase functions serve cast-vote --env-file supabase/functions/.env
```

The RLS security assertions can be run against any Postgres — see
[scripts/db/README.md](scripts/db/README.md). They also run in CI.

## Deployment

- **Frontend → GitHub Pages:** `.github/workflows/deploy-pages.yml` builds the
  static export (with `basePath=/<repo>`) and deploys on push to `main`. Set
  repo secrets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  Enable Pages with the **GitHub Actions** source.
- **Backend → Supabase:** `.github/workflows/deploy-supabase.yml` (manual) pushes
  migrations and deploys `cast-vote`. Required secrets are documented at the top
  of that workflow (access token, project ref, DB password, `VOTE_IP_PEPPER`,
  `ALLOWED_ORIGINS`).

## Tech notes

- ESPN league is configurable (`fifa.world` by default) — see
  `src/lib/espn/client.ts`.
- The vote contract lives once in `supabase/functions/_shared/vote.ts` and is
  shared by the client and the function (imported as `@shared/*`).
