# Test env via Cloudflare Pages (branch previews)

Goal: deploy in-progress changes to an isolated URL **without touching the
GitHub Pages prod `/baltfut`** (so the stream / live page never reloads).

Why not other options:
- `test.agomesp.github.io` — impossible; github.io project sites are path-based
  under one user domain, no arbitrary subdomains.
- `agomesp.github.io/baltfut?test-env` — the code must be deployed to PROD to
  flip the flag, and that deploy bumps `version.json` → UpdateBanner reloads the
  live page. Only good for dark-launching finished features, not a sandbox.
- One GitHub Pages site per repo; any deploy to it reloads viewers. So a real
  test env must be a different deploy target.

## Setup (one-time, ~5 min) — no code changes needed
`basePath` already defaults to `""` when `NEXT_PUBLIC_BASE_PATH` is unset, which
is correct for a root-served preview host.

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** →
   authorize Cloudflare's GitHub app (scope it to just `agomesp/baltfut`) → pick the repo.
2. Build settings:
   - Framework preset: **None** (it's a static export).
   - Build command: `npm run build`
   - Build output directory: `out`
   - Node: auto from `.nvmrc` (22). If not, set env `NODE_VERSION=22`.
3. Environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = (same as the GitHub repo secret)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (same; publishable/anon — safe)
   - leave `NEXT_PUBLIC_BASE_PATH` UNSET (→ served at root)
4. Save. Every branch push → a preview URL like `https://<branch>.baltfut.pages.dev`.
   The GitHub Pages prod `/baltfut` is never touched.

## Caveats
- **Shared prod DB:** the preview uses the same anon Supabase creds, so it reads/
  writes the SAME prod database. UI / reactions / Kick-chat testing is fine
  (reads). Submitting a palpite would write to PROD votes — and is CORS-blocked
  until the preview origin is added to `ALLOWED_ORIGINS` (a Supabase function
  secret; additive, safe for prod). Ask to add `https://<branch>.baltfut.pages.dev`
  (or the project's `*.pages.dev`) when you need voting on the preview.
- **Public preview URLs:** obscure but public. Add Cloudflare Access (free) for a
  password if you want it private.
- **Free tier:** unlimited bandwidth/sites/preview deploys, 500 builds/month, no card.

## Optional: isolated TEST database (second Supabase project)
For full data isolation (so test palpites/reactions don't hit prod):

1. Create a 2nd Supabase project `baltfut-test` (free plan allows 2 active
   projects/org → prod + test fits free).
2. Apply the same schema + function:
   `supabase link --project-ref <test-ref>` → `supabase db push`
   → `supabase functions deploy cast-vote`
   → set function secrets `VOTE_IP_PEPPER`, `ALLOWED_ORIGINS=<preview origin>`.
3. In Cloudflare Pages, set the **Preview** env `NEXT_PUBLIC_SUPABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the TEST project's values. Now the preview
   reads/writes the test DB only.

Caveats: free tier = 2 active projects; free projects pause after ~7 days idle
(one click to restore). Automatable once the test project's ref/keys are added
as repo secrets (`SUPABASE_TEST_*`) — I'd parametrize the Supabase deploy to push
migrations + the function to the test project, on the feature branch only.

## Vercel/Netlify alternative
Same idea, same settings (output `out`, base path empty). Pick whichever you
already have an account with.
