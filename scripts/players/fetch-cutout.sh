#!/usr/bin/env bash
# Self-host ONE player cutout into public/players/. Manual, run LOCALLY only —
# this is intentionally NOT wired into CI.
#
# ⚠️  Licensing: FUTBIN player renders are EA Sports / FUTBIN intellectual
#     property. FUTBIN's CDN is hotlink-open today but its signed URLs are
#     param-locked and revocable, and its ToS restricts reuse. Self-host a small
#     curated set at your own discretion; prefer CC-licensed art for production.
#     See docs/player-images-spike.md.
#
# Usage:
#   scripts/players/fetch-cutout.sh '<futbin-cdn-url>' eng/bellingham.png
set -euo pipefail
url="${1:?usage: fetch-cutout.sh <futbin-cdn-url> <code>/<slug>.png}"
rel="${2:?usage: fetch-cutout.sh <futbin-cdn-url> <code>/<slug>.png}"
dest="public/players/${rel}"
mkdir -p "$(dirname "$dest")"
curl -fsSL "$url" -o "$dest"
echo "saved $dest ($(wc -c < "$dest") bytes)"
echo "next: add { name: \"…\", img: \"${rel}\" } under its FIFA code in src/data/craques.ts"
