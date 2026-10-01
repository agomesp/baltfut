# BaltFut — Motion & Animation inventory

Every animation in the product, in plain UX language: **what** it is, **where**
on screen it appears, and **when** it fires. Grouped by area. Durations are given
so you can judge pacing.

> Accessibility note: the product respects "reduce motion" — when a user has that
> system setting on, the looping/decorative animations are switched off (only the
> screen-recording "REC" blink is forced to keep working in streamer mode).

---

## 1. Global chrome (always on screen)

### Tournament progress bar — header
- **What:** a thin glowing lime gradient bar that fills left→right to show how far
  the tournament has progressed (% of matches played).
- **Where:** directly under the "BaltFut" wordmark, full width of the header.
- **When:** always visible; the fill width updates as results come in.

### Bottom navigation — per-icon "living" icons
Each of the 6 tab icons has its own subtle looping micro-animation, but **only the
active tab's icon animates** (inactive icons are static). These run continuously
while that tab is selected.

| Tab | Icon motion | Feel |
| --- | --- | --- |
| **Ao vivo** | Wi-Fi style arcs pulse outward in sequence (~2.2s loop) | "broadcasting / live signal" |
| **Jogos** | Dots chase around a path, staggered | "schedule ticking" |
| **Grupos** | A grid of squares lights up in sequence | "tables populating" |
| **Result.** | Checkmarks draw in one after another | "results being ticked off" |
| **Chaves** | Bracket nodes pulse in sequence | "bracket advancing" |
| **AI** | Sparkles twinkle (staggered 1.4–1.8s) + the **label text runs a rainbow gradient** (~4s loop) | "magic / AI" |

### Active-tab pill
- **What:** the selected tab sits inside a solid **lime pill**; on hover any tab
  lifts/magnifies slightly.
- **Where:** the fixed bottom dock.
- **When:** on selection (the pill) and on hover (the lift).

### "Modo Streamer" button — attention pulse
- **What:** when screen-streaming mode is **off**, the button breathes with a soft
  **red glow + gentle scale** (~1.5s loop) to advertise itself.
- **Where:** bottom-right corner control.
- **When:** continuously while streamer mode is off; stops once enabled.

### Promo / store strip — auto-scroll
- **What:** a horizontal marquee of promo/store items scrolls continuously and
  seamlessly; **pauses on hover**.
- **Where:** a slim strip near the bottom of the Live tab.
- **When:** always looping when present.

---

## 2. Live tab — the match hero

### Team entrance
- **What:** when a match opens, the two teams **slide in from opposite edges**
  (home from the left, away from the right) and settle into place; the score
  fades in just after.
- **Where:** the big central scoreboard hero.
- **When:** ~1.25s after the hero mounts (i.e. on entering the Live tab or
  switching match) — a one-time entrance, not a loop.

### Crest flag — flag wave + sheen
- **What:** each circular team crest shows the country flag with a subtle **3D
  "wave"** (like cloth in wind, ~4.5s loop) plus a **light sheen sweep** across it
  (~5s loop).
- **Where:** the two crest medallions either side of the score.
- **When:** continuously while a match hero is shown.

### Live "pulse" dot
- **What:** a small red dot **breathes** (fades/scales) to signal "this is live".
- **Where:** next to the live clock / on live chips and the "AO VIVO" label.
- **When:** only while the shown match is actually in progress.

### Event chips — goals & cards travelling beam
- **What:** the little goal/card markers under the score have a **coloured beam
  that travels around their border** (green for goals, yellow/red for cards),
  ~3.6s loop.
- **Where:** the timeline of scorers/cards directly beneath the scoreline.
- **When:** continuously while events are present on a live/finished match.

### GOAL / CARD cinematic — the showpiece
- **What:** a full, ~**6.2-second** cinematic that takes over the hero when a new
  event is detected:
  1. The whole screen behind the hero **blurs and dims** (a dark frosted backdrop fades in).
  2. The two teams **slide off** to the sides and the score scales down out of the way.
  3. A **ball spins in a big arc** across the screen — entering from the bottom edge,
     looping up and around (multiple full rotations), heading toward the scorer.
  4. At the **moment of impact** (~84% through) there's a **white flash + a short
     screen-shake (micro-tremors)**.
  5. The **scorer/player pops up**, holds, then everything **fades back** to the
     normal hero.
  - For a **card**, the same choreography plays with a card projectile instead of a
    ball (red or yellow), tinted accordingly.
- **Where:** centred over the entire live hero area; the backdrop and projectile
  are pinned to the whole viewport (the ball literally enters from the screen edge).
- **When:** automatically, the instant the live feed reports a **score increase**
  or a **new card** for the shown match. Plays once per event.

### Squad wall / player cutouts (behind the hero)
- **What:** faint rows of player silhouettes **fade/rise in** behind the hero
  (staggered), with a soft **pulsing aura glow** behind them (~3.4s loop).
- **Where:** the backdrop layer of the live hero.
- **When:** the fade-in is a one-time entrance; the aura pulse loops.

### Reactions / emotes — floating particles
- **What:** emoji reactions **float upward and fade out** as they rise (each with
  a slightly different speed/path).
- **Where:** rising from the bottom of the live stage; also mirrors reactions from
  the connected Kick chat.
- **When:** each time a reaction is sent (by the user or incoming from chat).

---

## 3. Live tab — the prediction panel ("palpite")

### Score steppers
- **What:** the +/- buttons change the predicted score; numbers swap instantly.
  When prediction is no longer allowed (kickoff passed / match finished) the whole
  stepper **greys out and dims** (disabled state).
- **Where:** the two big score dials (home / away) in the prediction form.
- **When:** greying happens automatically once the cutoff is reached.

### Submit button — "saving" shimmer + label swap
- **What:** pressing **"ENVIAR PALPITE →"** puts the button into a saving state:
  the label changes to **"ENVIANDO…"**, the button **dims slightly**, and a
  **light shimmer sweeps across it** (~1.15s loop) while the prediction is being
  recorded.
- **Where:** the full-width lime CTA under the score dials.
- **When:** from the moment of tap until the server confirms (or returns an error).

### Confirmed prediction → "VOCÊ" tag
- **What:** once saved, the user's prediction appears in the **predictions table**
  with a green **"VOCÊ"** tag and is visually prioritised (pinned/highlighted) so
  they can find themselves instantly.
- **Where:** the "Palpites enviados" list (Live tab) and the "Ranking dos Subs".
- **When:** immediately after a successful submit, and on every later visit (the
  name is remembered on the device).

### "Cravou o placar" badge
- **What:** a badge marking predictions that **exactly match the live/final score**
  ("nailed it").
- **Where:** on rows in the predictions list during/after a live match.
- **When:** appears live as the real score matches a given prediction.

---

## 4. Match-selector rail (chips) — Live tab

### Chip hover lift
- **What:** match chips **scale up and rise** slightly on hover.
- **Where:** the horizontally-scrolling rail of matches above the hero.
- **When:** on hover (desktop pointer).

### Chip live dot
- **What:** a small **pulsing dot** marks chips whose match is live (only pulses on
  non-selected live chips).
- **Where:** on each match chip in the rail.
- **When:** while that match is live.

### Concurrent (combined) chip
- **What:** when two games are co-shown, they collapse into **one combined chip**;
  this forms/dissolves automatically as the live window opens and closes.
- **Where:** the chip rail.
- **When:** when two matches kick off together (or overlap within the live window).

---

## 5. Picture-in-Picture (PiP) keep-alive ticker

- **What:** a compact floating score ticker whose row of scores **scrolls
  horizontally on a loop** (~26s); **pauses on hover**.
- **Where:** the small always-on-top PiP window (used to keep the tab alive while
  streaming).
- **When:** continuously while PiP is open.

---

## 6. Grids, brackets & lists (subtle "alive" motion)

### Loading / placeholder chase
- **What:** grid cells, bracket nodes and table rows can show a **staggered opacity
  "chase"** (a wave of brightness sweeping across cells).
- **Where:** Groups tables, Bracket nodes, and icon glyphs.
- **When:** primarily as a lightweight loading/idle shimmer.

### Generic fade-up
- **What:** content blocks **fade up** into place as they appear.
- **Where:** across views as sections mount.
- **When:** on mount / first paint of a section.

---

## 7. Screen-recording indicator

- **What:** a **"REC" dot blinks** (~1.5s loop) and is intentionally kept animating
  even when "reduce motion" is on — so streamers always see the live indicator.
- **Where:** corner indicator while streamer/recording mode is active.
- **When:** while recording/streamer mode is on.

---

## Quick reference — pacing summary

| Animation | Loop / one-shot | Approx duration |
| --- | --- | --- |
| Tournament progress fill | data-driven | — |
| Active-tab icon micro-motions | loop | 1.4–2.2s |
| AI label rainbow | loop | 4s |
| Streamer-button red glow | loop | 1.5s |
| Promo strip / PiP ticker | loop | 20–26s |
| Team entrance (hero) | one-shot | 0.6s (after 1.25s delay) |
| Crest flag wave / sheen | loop | 4.5s / 5s |
| Live pulse dot | loop | 1.4–1.5s |
| Event chip beam | loop | 3.6s |
| **Goal/Card cinematic** | one-shot per event | **6.2s** |
| Squad-wall aura | loop | 3.4s |
| Reaction float | one-shot per emote | ~variable |
| **Submit shimmer** | loop until done | 1.15s |
| Chip hover lift | on hover | ~0.16s |
