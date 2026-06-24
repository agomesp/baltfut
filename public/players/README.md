# public/players/

Self-hosted transparent **craque** cutouts for the AO VIVO hero, by FIFA code:
`public/players/<code>/<slug>.png` (e.g. `eng/bellingham.png`). Registered in
[`src/data/craques.ts`](../../src/data/craques.ts); resolved by
[`src/lib/player-images.ts`](../../src/lib/player-images.ts).

- Rendering is behind `NEXT_PUBLIC_PLAYER_CUTOUTS=1` (off by default).
- `eng/bellingham.png` is a **generated placeholder** (silhouette, no third-party
  art) from `scripts/players/make-placeholder.py`.
- Add one: `scripts/players/fetch-cutout.sh '<url>' <code>/<slug>.png`, then add
  an entry in `craques.ts`.

⚠️ **Licensing:** FUTBIN renders are EA Sports / FUTBIN IP. See
[`docs/player-images-spike.md`](../../docs/player-images-spike.md) before
committing real art or enabling the flag in production.
