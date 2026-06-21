@AGENTS.md

# baltfut — working notes

Live soccer scores (ESPN) + community vote on preferred team & predicted score.
Static Next.js frontend on GitHub Pages, Supabase Postgres + one Edge Function.
No end-user auth. **Secure-first.** See [SECURITY.md](SECURITY.md) and
[README.md](README.md).

## Toolchain — read first

- **Node 22 is required** but the machine's default shell resolves to Node
  18.15.0. Always `nvm use` (repo has `.nvmrc` → 22) before any npm/next/vitest
  command, e.g.:
  `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`
- Shell is **zsh**: it does NOT word-split unquoted variables (no `$CMD` tricks).
- Deno (for the edge function) installed at `~/.deno/bin/deno`.

## Discipline

TDD-first (write the failing test, then code), every commit green
(typecheck + lint `--max-warnings 0` + `npm test` + `npm run build`), small
commits. Run `npm run build` before finishing UI work — it's the static-export
gate.

## Architecture map

- `src/lib/espn/` — zod-validated ESPN data (keyless, CORS-open, browser-direct):
  `client` (scoreboard, `dates` range), `parse` (Match + venue + goal scorers),
  `standings` (12 groups + teamGroupMap), `lineups` (summary → XI), `bracket`
  (schematic). All TDD'd against fixtures.
- `supabase/functions/_shared/vote.ts` — **canonical** prediction zod schema
  (name + predicted score) + `validateVote`. Imported by the client (`@shared/*`)
  AND the Deno function. One source of truth; don't fork it.
- `supabase/functions/_shared/{ip,cors}.ts` — server-side IP hashing + CORS
  allow-list (pure, unit-tested in Node).
- `supabase/functions/cast-vote/index.ts` — Deno handler; the ONLY writer to
  `votes` (service_role). Excluded from app `tsc`; checked via `deno check`.
- `src/lib/supabase/client.ts` — browser client (anon key; null when unconfigured).
- `src/lib/votes/` — `submitVote` (injectable transport), `fetchVoteEntries`
  (predictions feed), `classifyPrediction`/`rankPredictions` (live winning/
  can-win/losing), barrel.
- `src/lib/format.ts` — pt-BR date/time + day grouping in BRT (`America/Sao_Paulo`).
- `src/lib/team-names.ts` — pt-BR country names by FIFA code (English fallback).
- `src/components/` — `header` + the 5 views (`live-view`, `fixtures-view`,
  `groups-view`, `results-view`, `bracket-view`) + `prediction-panel`,
  `primitives`, `match-meta`. `src/app/page.tsx` orchestrates state + fetching.
- `supabase/migrations/*_create_votes.sql` — schema + RLS.

## Security invariants — do NOT break

1. `ip_hash` and `id` are never granted to `anon` (column-level SELECT only).
2. `anon` has no insert/update/delete on `votes`; the Edge Function is the only
   writer. Keep RLS enabled + forced.
3. The service_role key never appears in frontend code or the bundle.
4. Read views stay `security_invoker = true` (never SECURITY DEFINER).
5. The shared zod schema validates on client AND server; CHECK constraints mirror it.
6. CORS uses the `ALLOWED_ORIGINS` allow-list, not `*`.

Changes to any of these: re-run `scripts/db/` assertions (CI `database` job does).

## Conventions / gotchas

- Path aliases: `@/*` → `src/*`, `@shared/*` → `supabase/functions/_shared/*`
  (tsconfig + vitest). `supabase/functions/**/index.ts` is excluded from app tsc
  (Deno globals).
- RTL: `getByText(/regex/)` matches ancestors too (throws on multiples); prefer
  exact strings for nested text.
- `vi.fn()` infers an empty-arg tuple — type it (`vi.fn<T>()`) when asserting on
  `mock.calls`.
- `postcss` is pinned via `overrides` (>=8.5.10) to keep `npm audit` clean
  without downgrading Next.
- **Grants gotcha (bit us once):** the Supabase project has "Automatically
  expose new tables" OFF, so a NEW table gets ZERO grants by default — not even
  to `service_role`. `BYPASSRLS` skips RLS *policies*, NOT table-level GRANTs, so
  the Edge Function (service_role) needs an explicit `grant ... on <table> to
  service_role`, and anon needs explicit column grants. Every new table/migration
  must grant both. `scripts/db/rls_roles.sql` intentionally does NOT pre-grant
  service_role so the assertions mirror prod and catch a missing grant.

## Deployment (LIVE)

- Repo: https://github.com/agomesp/baltfut (public). Site:
  https://agomesp.github.io/baltfut/ (Pages, source = GitHub Actions).
- Push to `main` → CI runs and Pages auto-deploys (anon Supabase env from repo
  secrets; basePath `/baltfut`).
- Supabase project is linked; the `votes` migration is **applied to prod** and
  `cast-vote` is deployed. Verified on prod: anon reads `vote_entries`, is denied
  `ip_hash` + direct writes; function gateway accepts the `sb_publishable_…` key
  with `verify_jwt=true`; CORS locked to the Pages origin.
- **The initial migration is now deployed — treat it as immutable.** Schema
  changes go in NEW `supabase/migrations/*.sql` files; then run the **Deploy
  Supabase** workflow (`gh workflow run deploy-supabase.yml`, manual).
- Repo secrets set: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, SUPABASE_PROJECT_REF/
  ACCESS_TOKEN/DB_PASSWORD, VOTE_IP_PEPPER, ALLOWED_ORIGINS.

## Pending / next

- The 5-tab design handoff is **applied** (pt-BR, Allan Gomes design system,
  dark/light, follow-team). UI is custom inline-styled (no shadcn).
- Vote integrity is the **basic** tier. Strong tier (Cloudflare Turnstile +
  trusted IP) is the planned hardening; write path already routes through the
  function so it's additive.
- ESPN league is `fifa.world` by default; multi-league is a small extension.
- Bracket is schematic (placeholders) per the design — wire to a real bracket
  endpoint once the group stage resolves. Goal scorers come from the scoreboard
  `details`; lineups from the summary endpoint (may be absent pre-match).
