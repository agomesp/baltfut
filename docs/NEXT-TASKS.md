# Next tasks / pending local work — DO NOT DEPLOY UNTIL REVIEWED

This file tracks work that is implemented **locally only** (uncommitted, not
deployed) plus designs to pick up **before** the next deploy. Created so the
streamer's live page isn't disturbed mid-event.

---

## 0. PENDING-LOCAL CHECKLIST (before committing / deploying)

### A. Client changes — uncommitted, need a **Pages deploy** (reloads the stream)
Deploy these as ONE Pages deploy at a tolerable moment (halftime = one reload):
- [ ] `header.tsx` — title-row border + 14px nav
- [ ] `page.tsx` — main padding `10px 23px 60px`
- [ ] `live-view.tsx` — fill-viewport + internal-scroll columns; **2-match split
      view** (auto when ≥2 live: matches stacked top/bottom, each with its own
      palpites + a small `dense` BigDetail top-anchored, smaller goals/cards, no
      HeroFx; wider match area, narrower Ranking `width={206}`). Uses `allEntries`
      filtered per match — no page.tsx/data-flow change.
- [ ] **Deleted `public/test/`** (the /test OBS keep-alive harness page).
- [ ] `chip-carousel.tsx` — pill row margin
- [ ] `prediction-panel.tsx` — clear stale "Esse nome já foi usado" on match change
- [ ] `ranking.ts` (+ test) — order by correct palpites only (losses not in sort)
- [ ] `promo-link.tsx` — **DELETED** (the floating RB STORE button is gone; the
      promo bar's CTA replaces it). Also removed from `layout.tsx`.
- [ ] `promo-showcase.tsx` + `globals.css` (marquee keyframe) + `live-view.tsx`
      — slim auto-scrolling RB Store promo bar **on top of the live score**
      (`PROMO_BAR_H`); cards link to deals, CTA → channel
- [ ] **Promo data:** `scripts/telegram-pull.mjs` (no-secret Telegram fetch) +
      `public/promos.json` (generated, currently untracked). Decide delivery
      before deploy: commit snapshot / cron-commit / non-Pages endpoint
      (see `docs/telegram-spike.md`). CORS = page can't fetch `t.me` directly.

### A2. Performance audit (streamer) — done + remaining
The streamer's main cost is **simultaneously-decoding `<video>`s** (each `LoopVideo`
also runs a 10s re-arm interval + visibilitychange listener):
- ✅ **Split view** skips `HeroFx` entirely → in 2-match mode the only video is the
  KeepAlive strip (was ~6–8 videos across both heroes).
- ✅ **Kick badge dot** is now CSS (`rec-blink`) instead of `live-dot.mp4` — one
  fewer decode everywhere it shows.
- **Remaining candidates (need your OK — they change look / safety):**
  - `ambient-pitch` full-bleed `<video>` in the single-match hero (opacity .14) —
    the heaviest single decode. Could become a static gradient. Big GPU win.
  - `keep-alive.tsx` always-on 4px `<video>` — its anti-freeze job is now covered
    by the Modo Streamer PiP; redundant if you always run the PiP. Removing it
    drops one always-on decode for everyone (but non-PiP captures lose the net).
  - `flag-shine.mp4` — only when a team is followed; minor, leave or drop.
  Other loops (heartbeat 1 Hz worker, scoreboard worker, promo CSS marquee) are
  cheap and fine.

### B. 🚫 REMOVE BEFORE ANY COMMIT — dev-only scaffolding
- [ ] **Delete `src/lib/dev-mock.ts`**
- [ ] **`page.tsx`: flip `const USE_MOCK = true` → `false`** (or strip the seed
      effect + every `if (USE_MOCK) return;` guard + the import)
- [ ] Confirm `page.test.tsx` passes again (it fails *only* while the mock is on)

### C. ✅ DONE — homoglyph hardening (server + DB, **already deployed**)
Committed on the feature branch (NOT main) and applied via `deploy-supabase`
(run 27990696970) — server-only, **did not touch the stream**:
- migration `*_name_claims_canon_hardening.sql` (name_canon), `cast-vote`
  (`nameSkeleton` guard + name_canon), `vote.ts` charset (Latin + ASCII digits).
  Smoke-tested: cross-script name → 422.
- [ ] Later: fold these into **main** with the rest (migration = no-op re-apply;
      prod already records version 20260622210000). The client instant-feedback
      half of the charset only shows after that Pages deploy.

### D. 🔒 NEVER COMMIT — local admin panel
- `admin/` is `.gitignore`d (whole dir). Privileged service_role tool; refuses to
  run unless `ADMIN_LOCAL=1` and not prod; binds 127.0.0.1. Keep it that way.

### E. Docs (local, commit when ready)
- `docs/NEXT-TASKS.md`, `docs/telegram-spike.md`.

### Gate before the finishing commit
`npm run typecheck && npm run lint -- --max-warnings 0 && npm test && npm run
build` (+ `deno check supabase/functions/cast-vote/index.ts`; deno at
`/opt/homebrew/bin/deno`). All green **after** step B (mock removed).

---

## 1. NEXT TASK — Per-match palpite **deadline override** (reopen the clock)

Goal: from the DB, reopen / extend the palpite window for ONE specific match
past the kickoff+5min cutoff (e.g. "open 760457 again for 20 min"). The cutoff
is enforced in **two** layers, so a pure DB flag can't do it today — both must
read an override.

### Design (recommended)

**Migration — override table:**
```sql
create table public.palpite_deadline_overrides (
  match_id   text primary key,
  open_until timestamptz not null,            -- palpites allowed until this moment
  reason     text,
  created_at timestamptz not null default now()
);
alter table public.palpite_deadline_overrides enable row level security;
alter table public.palpite_deadline_overrides force row level security;
revoke all on public.palpite_deadline_overrides from anon, authenticated;
grant select on public.palpite_deadline_overrides to anon, authenticated; -- read-only
grant select on public.palpite_deadline_overrides to service_role;        -- function reads it
create policy "Public can read overrides" on public.palpite_deadline_overrides
  for select to anon, authenticated using (true);
-- No write policy → only admin (Studio/service_role) writes. Remember the grants
-- gotcha: a NEW table gets ZERO grants by default on this project.
```

**Server (`_shared/deadline.ts` + `cast-vote/index.ts`):**
- `palpitesClosed(timing, now, grace, openUntilMs?)` → add, AFTER the
  `state === "post"` check: `if (openUntilMs != null && now <= openUntilMs) return false;`
  (so you can extend a pre/live match but NOT reopen a finished one).
- In `cast-vote`: before the ESPN block, `select open_until from
  palpite_deadline_overrides where match_id = vote.matchId`; pass into
  `palpitesClosed`.
- **Deploys via `deploy-supabase` → no Pages deploy, no stream disruption.**

**Client (`page.tsx` + `prediction-panel.tsx`):**
- Fetch overrides (anon select) → `Map<matchId, openUntilMs>`.
- `prediction-panel` open gate: `open = isPalpiteOpen(closesAt, now) ||
  (overrideUntil != null && now < overrideUntil)`; also add the match to the
  `released` set so it isn't "não liberados".
- ⚠️ This client half **requires a Pages deploy** to reach the live page — the
  ONLY piece that triggers the UpdateBanner/refresh. Land it when the stream can
  tolerate it. (Server half alone makes the API accept late palpites, but the
  form stays locked client-side until this ships.)

**Usage once shipped (pure DB injection, no code/deploy per use):**
```sql
insert into public.palpite_deadline_overrides (match_id, open_until, reason)
values ('760457', now() + interval '20 minutes', 'reabertura manual')
on conflict (match_id) do update set open_until = excluded.open_until, reason = excluded.reason;
-- revoke early:
delete from public.palpite_deadline_overrides where match_id = '760457';
```

### Caveats
- Keep the **finished-match block** even with an override (override check AFTER
  `state==='post'`) — reopening a finished match is pure result-gaming.
- Late palpiters can see the current score during the override window — only
  reopen pre/just-kicked-off matches intentionally.
- Add a CI `database` assertion: anon can read, not write, the new table.
- TDD `palpitesClosed` with the new arg (override active / expired / finished
  still closed) before the function change.

---

## 2. NEXT TASK — Local-only admin panel (uncommittable, undeployed)

Goal: a localhost-only UI to insert/edit/delete palpites, inspect whether two
nicknames came from the same client (ip_hash / token), and reopen a match's
palpite clock — without committing or deploying anything.

### Feasibility: YES, with the right boundary
- **Never ship admin write code to the static site.** The public bundle is
  anon-only by design; the service_role key must never enter it. So the admin
  panel must be a **separate local-only surface** that talks to prod with
  privileged creds kept off-repo.
- Recommended shape: a tiny **local Node/Express (or Next route handler run only
  in `next dev`) on localhost** that holds the `service_role` key (or DB
  connection string) in a **gitignored** `.env.local`, and exposes
  insert/edit/delete + read-ip_hash endpoints. A minimal local React page calls
  it. Guard so it refuses to run in production builds (e.g. throw unless
  `process.env.ADMIN_LOCAL === '1'`), and keep the file under a path added to
  `.gitignore` so it can't be committed.
- **ip_hash matching** (the "same client?" check) is admin-only — read it via
  this local service (service_role), never via anon. Reuse the
  `_shared/name-normalize` skeleton to also flag look-alike names.
- **Reopen the palpite clock** = write a row to `palpite_deadline_overrides`
  (task #1) — the admin panel is just a friendlier front-end for that SQL.
- Lower-effort alternative that needs **no code**: Supabase **Studio SQL
  Editor** with saved snippets (insert/edit/delete + the ip_hash compare +
  override insert). This is what we've been using and is the safest for "quick".

### Guardrails (must)
- `.gitignore` the admin files + `.env.local`; never commit the service_role
  key. Refuse to build/run in prod. Keep the panel off-screen on stream.
- Audit log: write a `reason`/timestamp for manual mutations (a notes column or
  a small `admin_audit` table) so manual data edits are traceable.

---

## 3. Question parked — Telegram promo feed (display group items on the page)

Feasible. Options (see chat for detail):
- **Bot in the group + small server cache:** a Telegram bot (BotFather) added to
  the group reads messages via `getUpdates`/webhook; a tiny server stores the
  latest N promo posts as JSON that the static page fetches. Needs a running
  component (same cost discussion as the live-poll server) + the page reading a
  JSON endpoint.
- **No-server-but-manual:** export/curate promo items into a static JSON in the
  repo; page renders them. Zero infra, manual refresh.
- Constraints: only the **bot** can read group messages it has access to (Bot
  API can't read arbitrary public-channel history without being a member/admin);
  respect Telegram ToS + rate limits; sanitize/whitelist rendered content (no
  raw HTML from messages) — same XSS discipline as the reactions whitelist.
- Recommendation: if promos are low-frequency, the curated-static-JSON route is
  the cheapest and keeps the no-backend posture; reach for the bot+cache only if
  you want them live.
