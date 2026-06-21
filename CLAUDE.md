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

- `src/lib/espn/` — ESPN client + zod-validated parser → normalized `Match`.
  Keyless, CORS-open; fetched directly from the browser.
- `supabase/functions/_shared/vote.ts` — **canonical** vote zod schema +
  `validateVote`. Imported by the client (`@shared/*` alias) AND the Deno
  function. One source of truth; don't fork it.
- `supabase/functions/_shared/{ip,cors}.ts` — server-side IP hashing + CORS
  allow-list (pure, unit-tested in Node).
- `supabase/functions/cast-vote/index.ts` — Deno handler; the ONLY writer to
  `votes` (service_role). Excluded from app `tsc`; checked via `deno check`.
- `src/lib/supabase/client.ts` — browser client (anon key; null when unconfigured).
- `src/lib/votes/` — `submitVote` (injectable transport), result mappers,
  fetchers, and the app re-export barrel.
- `src/components/` — `MatchCard`, `VoteForm`. `src/app/page.tsx` wires them.
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

## Pending / next

- **A custom HTML design is incoming** — current UI (`MatchCard`/`VoteForm`/
  page) is a functional placeholder to be restyled. Keep the data layer + the
  security model; swap the presentation.
- Vote integrity is the **basic** tier. Strong tier (Cloudflare Turnstile +
  trusted IP) is the planned hardening; write path already routes through the
  function so it's additive.
- ESPN league is `fifa.world` by default; multi-league is a small extension.
