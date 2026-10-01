# BaltFut — UX/UI audit pack

A complete visual + behavioural snapshot of **BaltFut**, a pt-BR live-soccer
companion for the 2026 World Cup: live ESPN scores + a community game where
people predict the exact final score ("palpite") of each match.

This folder is built to be handed to a UX/UI reviewer. It contains:

- **`screenshots/`** — every screen, at three screen sizes, plus mocked live
  scenarios and the prediction-flow states. See the index below.
- **`ANIMATIONS.md`** — every motion/animation in the product: what it is, where
  on screen it lives, and when it fires. Written in plain UX language.
- **`USER-FLOWS.md`** — step-by-step user journeys for every feature, including
  the exact micro-states (loading glow → confirmed "VOCÊ" row → disabled steppers).

---

## How to read the screenshots

Every scene is captured twice:

| Suffix | Meaning |
| --- | --- |
| `…__fold.png` | **What fits on screen** at that exact resolution (the "fold"). Use this to judge what a user sees without scrolling. |
| `…__full.png` | **The entire page, top to bottom** (stitched full-page capture). Use this to judge the full content, spacing and scroll length. |

File naming: `scenario__tab__viewport__capture.png`

**Screen sizes**
- `desktop-1920x1080` — full HD desktop
- `tablet-768x1024` — portrait tablet (iPad-class)
- `mobile-390x844` — modern phone

### Scenarios

| Scenario | What it shows | Data |
| --- | --- | --- |
| `real__*` | The 6 real tabs with live tournament data | Real ESPN feed |
| `prematch__live` | Live tab when the next match hasn't kicked off → the **prediction form** is the centrepiece | Mocked: next match in ~2h |
| `live-single__live` | Live tab with **one match in progress** (BRA 2–1 ARG) | Mocked single live game |
| `live-duo__live` | Live tab with **two simultaneous matches** side-by-side | Mocked two concurrent live games |
| `palpite__form-empty` | Prediction form, fresh visitor (no name yet) | Mocked pre-match |
| `palpite__form-filled` | Prediction form with name typed + score dialled in | Mocked pre-match |
| `palpite__after-submit-voce` | The predictions table after submitting — the user's own row tagged **"VOCÊ"** in green, pinned on top | Mocked pre-match |

### The 6 tabs (bottom navigation)

| Tab key | Label (pt-BR) | Screen |
| --- | --- | --- |
| `live` | **Ao vivo** | Live match hero + score, prediction panel, live ranking |
| `matches` | **Jogos** | Upcoming fixtures, "next match" hero, calendar by date |
| `groups` | **Grupos** | 12 group-stage standings tables (A–L) |
| `results` | **Result.** | Finished matches, newest first, grouped by day |
| `bracket` | **Chaves** | Knockout tree (R32 → final) |
| `ai` | **AI** | AI-generated predictions + simulated bracket |

---

## Notes for the reviewer

- **Language:** the entire product is Brazilian Portuguese.
- **Theme:** dark, "pitch-green" stadium palette with an electric-lime (`#c8ff2d`)
  accent used for all primary actions and the user's own highlights. The Live tab
  is dark-only by design; other tabs support light/dark.
- **No login.** Identity is just a nickname the user types once; it's then locked
  to that device and their predictions are tagged **"VOCÊ"**.
- **Entertainment only.** A disclaimer in the header states it's not betting.
- The mocked scenarios exist because, in the real feed, you can't guarantee a
  single-live or exactly-two-simultaneous-live moment on demand — these are the
  states the prediction game is designed around.
