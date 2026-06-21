# Security model

baltfut is a fully public, anonymous app: a static frontend on GitHub Pages, a
Supabase Postgres database, and one Supabase Edge Function. There is no end-user
login. "Secure-first" here means the database is the source of truth for access
control and the only write path is server-side and rate-limited.

## Trust boundaries

| Actor | Can do | Cannot do |
| --- | --- | --- |
| Anonymous visitor (browser, anon key) | Read live scores from ESPN; read **public** vote columns + `vote_results` / `vote_entries` views | Read `id` or `ip_hash`; insert / update / delete votes directly |
| `cast-vote` Edge Function (service_role) | Insert validated votes; derive + store the IP hash | — |
| `service_role` key | Full DB access | Never shipped to the browser; lives only in the function + CI secrets |

## Keys & secrets

- **Anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) is public by design and inlined
  in the static bundle. Safe because RLS — not key secrecy — guards the data.
- **service_role key** is never referenced by frontend code. It is injected by
  the Supabase platform into the Edge Function and used nowhere else.
- **VOTE_IP_PEPPER** and **ALLOWED_ORIGINS** are Edge Function secrets set via
  `supabase secrets set` (or the deploy workflow). Never exposed to clients.
- `.env*` is gitignored except `.env.example`. No real secret is committed.

## Database (RLS)

Defined in `supabase/migrations/*_create_votes.sql`:

- RLS is **enabled and forced** on `public.votes`.
- `anon`/`authenticated` get **column-level** `SELECT` on public columns only
  (`match_id, league, username, preferred_side, preferred_team_abbr, pred_home,
  pred_away, created_at`) — **never** `id` or `ip_hash` — plus a read policy.
- **No** insert/update/delete grant or policy for `anon` → all writes are
  impossible except through the Edge Function (service_role, which bypasses RLS).
- `vote_results` and `vote_entries` are `security_invoker = true` views, so they
  run with the caller's grants and physically cannot return `ip_hash`. (No
  `SECURITY DEFINER` views, which would bypass RLS.)
- CHECK constraints (score range, side enum, safe username, slug/id formats) are
  DB-level defense-in-depth, duplicating the app/function validation.
- `UNIQUE(match_id, ip_hash)` enforces one vote per IP per match.

These properties are asserted in CI against a real Postgres — see
`scripts/db/` and the `database` job in `.github/workflows/ci.yml`.

## Vote integrity ("basic now, strong-ready")

- The IP is derived **server-side** in the function (a static page cannot be
  trusted to report its own IP) and stored only as `sha256(pepper + ip)`. The
  raw IP is never persisted.
- `UNIQUE(match_id, ip_hash)` blocks the "refresh and vote again" case the
  product cares about.
- **Known limitation:** the basic tier reads the first `x-forwarded-for` hop,
  which a determined attacker could spoof. The **strong tier** (not yet wired)
  adds Cloudflare Turnstile + a platform-trusted IP source. Hooks are in place:
  the write path already goes through the function, so hardening is additive.

## Input validation (defense in depth)

One shared zod schema (`supabase/functions/_shared/vote.ts`) validates votes in
three places: the browser (UX), the Edge Function (the authoritative gate), and
the database (CHECK constraints). The username charset rejects control
characters and angle brackets so nothing markup-like is ever stored.

## CORS

The function echoes `Access-Control-Allow-Origin` only for origins on the
explicit `ALLOWED_ORIGINS` allow-list (no blanket `*`). ESPN's API is read-only,
keyless, and already sends `Access-Control-Allow-Origin: *`, so scores are
fetched directly from the browser with no proxy or secret.

## Dependencies

`npm audit` is part of the workflow expectations and currently reports **0
vulnerabilities**. A `postcss` override (`>=8.5.10`, GHSA-qx2v-qp2m-jg93) patches
a transitive dev/build-time advisory without downgrading Next.

## Reporting

This is a personal project; open a private issue or contact the maintainer for
anything sensitive.
