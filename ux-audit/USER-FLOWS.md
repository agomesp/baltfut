# BaltFut — User flows

Step-by-step journeys for every feature, written from the user's point of view.
Each arrow (`→`) is one observable step or state change. Micro-states (loading,
confirmed, disabled) are called out because they're central to the experience.

Legend: **[screen]** = where the user is · _italics_ = a UI state · `lime` = the
primary action colour.

---

## A. First visit & orientation

1. User lands on the app → opens on the **[Ao vivo]** tab by default.
2. Header shows the **BaltFut** wordmark, a glowing tournament-progress bar, and a
   small **entertainment-only** disclaimer (this is not betting).
3. A **bottom navigation dock** is always present: `Ao vivo · Jogos · Grupos ·
   Result. · Chaves · AI`. The active tab sits in a `lime` pill; its icon gently
   animates.
4. The Live tab shows whichever match is most relevant right now:
   - if a game is **live** → that game;
   - else the **next upcoming** game (with its prediction form);
   - else the **most recent** finished game.

_Screens:_ `real__live__*`

---

## B. Navigating between sections

1. **[any tab]** User taps a destination in the bottom dock.
2. → The tapped tab slides into the `lime` active pill; its icon begins its
   per-tab micro-animation; content swaps to that section.
3. The dock is horizontally scrollable on small screens so all 6 tabs stay reachable.

_Screens:_ all `real__*` (one per tab × 3 sizes)

---

## C. Make a prediction for an upcoming match  ⭐ (core flow)

This is the example flow, fully expanded.

**Pre-condition:** the next match hasn't kicked off (prediction is open).

1. **[Ao vivo]** The next match is featured: two flags + team names (e.g.
   **BRASIL vs ARGENTINA**) and a **live countdown** to kickoff (e.g. `1:58:06`).
   _Screen:_ `prematch__live__*`, `palpite__form-empty__*`
2. → User types their **nickname** into the name field.
   - _First time:_ the field is editable and empty.
   - _Returning:_ the name is **already filled and locked** to this device (no
     retyping; it can be reset).
3. → User sets the **predicted score** using the two big +/- dials (home / away),
   e.g. tap `+` twice on BRA → `2`, once on ARG → `1`.
   _State:_ numbers update instantly; the `lime` **"ENVIAR PALPITE →"** button is
   enabled. _Screen:_ `palpite__form-filled__*`
4. → User presses **"ENVIAR PALPITE →"**.
   - _Loading state:_ the button label flips to **"ENVIANDO…"**, the button **dims**
     and a **shimmer sweeps across it** while the prediction is saved.
5. → On success:
   - The user's prediction **renders in the predictions table** ("Palpites
     enviados").
   - Their row is **pinned to the top, highlighted, and tagged green "VOCÊ"** so
     they can spot themselves instantly.
   _Screen:_ `palpite__after-submit-voce__*`
6. → The prediction is now **committed**: the score dials and the submit button
   for that match **grey out / disable** (one prediction per person per match).
   The remembered name carries to every future match.

**Why the states matter (UX):** the shimmer gives instant "it's working"
feedback; the green **VOCÊ** row turns an anonymous list into "me vs everyone";
the disabled state makes the "you've already locked this in" rule obvious without
an error message.

### C-2. Predict TWO simultaneous matches at once
1. **[Ao vivo]** Two games kicking off together are **paired** automatically; the
   chip rail shows them as a single combined chip.
2. → Pre-match, the panel invites the user to **predict both games** in one place.
3. → User fills each scoreline and submits — same loading→VOCÊ→disabled cycle per
   game.
   _Screen:_ `live-duo__live__*` (live form of the same pairing)

---

## D. Watching a live match

1. **[Ao vivo]** A live game is featured: big scoreboard with the **live clock**
   (e.g. `58'`), a **pulsing red live dot**, waving flag crests, and a timeline of
   **goal/card chips** under the score.
   _Screen:_ `live-single__live__*`
2. → As the real feed updates, **the moment a goal (or card) happens**, a ~6-second
   **cinematic** takes over the hero: background blurs, a ball/card spins across
   the screen, a flash + screen-shake on impact, the scorer pops up, then it
   settles back to the updated score. (See `ANIMATIONS.md` §2.)
3. Left of the hero: a breakdown of the **community's predictions** + a
   **consensus** bar (who's winning / can still win / has lost their prediction).
4. Right of the hero: the **live ranking** ("Ranking dos Subs") of predictors;
   exact-score predictions get a **"CRAVOU O PLACAR"** badge in real time.
5. → User can switch matches via the **chip rail** above the hero (chips lift on
   hover, live ones carry a pulsing dot).
6. → A secondary tab toggles the left panel between **PALPITES** and **ESCALAÇÃO**
   (line-ups), when line-up data is available.

---

## E. Follow a team

1. **[Grupos]** (or fixtures) User taps a team row.
2. → That team is **highlighted in `lime` with a follow indicator (dot)** wherever
   it appears across the app (fixtures, groups, results).
3. → Tapping again unfollows; a follow pill can also surface in the header.

_Screens:_ `real__groups__*`

---

## F. Browse upcoming fixtures — [Jogos]

1. **[Jogos]** A **"PRÓXIMO JOGO"** hero card shows the next match (big flags +
   kickoff time).
2. → Below, the full schedule is **grouped by date** (Brazil time), oldest→newest.
3. → A followed team's fixtures are highlighted; tapping a fixture leads into its
   prediction/live context.

_Screens:_ `real__matches__*`

---

## G. Group standings — [Grupos]

1. **[Grupos]** All **12 groups (A–L)** render as compact tables.
2. Columns: matches played, goal difference, points; the **top-two qualifying
   spots** are marked.
3. → Tapping a country follows it (flow E).

_Screens:_ `real__groups__*`

---

## H. Results — [Result.]

1. **[Result.]** Finished matches, **newest first**, grouped by day.
2. The **winner's score is emphasised** (white) and the loser dimmed; venue and
   stage labels are shown.

_Screens:_ `real__results__*`

---

## I. Knockout bracket — [Chaves]

1. **[Chaves]** A horizontally-scrolling knockout tree: Round of 32 → QF → SF →
   Final, ending in a **Champion** slot.
2. Decided matchups show real teams/flags; not-yet-qualified slots show
   **placeholders/seeds**.
3. → User scrolls right to follow the path toward the final.

_Screens:_ `real__bracket__*`

---

## J. AI predictions — [AI]

1. **[AI]** AI-generated predictions for upcoming matches, each with a
   **confidence bar/%**.
2. A **simulated knockout bracket** projects a likely champion.
3. The AI tab is visually distinct: sparkles + a rainbow-animated label.

_Screens:_ `real__ai__*`

---

## K. Send a reaction (emote)

1. **[Ao vivo]** During a match, the user sends an emoji reaction.
2. → The emote **floats up from the bottom of the stage and fades out**; reactions
   coming from the connected Kick chat appear the same way.

---

## L. Streamer mode & Picture-in-Picture (for broadcasters)

1. **[any tab]** While off, the **"Modo Streamer"** button **pulses with a red
   glow** to advertise itself.
2. → User enables it → opens a **keep-alive Picture-in-Picture** score ticker (a
   small always-on-top window whose scores scroll on a loop) so the live data
   keeps updating even when the tab/window isn't focused.
3. A blinking **"REC"** indicator confirms streamer mode is active (kept visible
   even with reduce-motion on).

---

## Edge & error states (prediction)

| Situation | What the user sees |
| --- | --- |
| Match already kicked off / finished | Score dials + submit **greyed out and disabled**; predicting is closed. |
| User already predicted this match | Their row stays shown with **"VOCÊ"**; the form is locked (no second entry). |
| Network error on submit | Button returns from "ENVIANDO…" to active with an inline **"erro de rede — tente novamente"** message; nothing is lost. |
| Invalid score input | Offending field is flagged with a **"corrija os campos destacados"** message. |
| Name already taken by another device | The submit is rejected with a clear message (nickname ownership is device-locked). |
| Voting not available | The prediction panel degrades gracefully — scores are still shown read-only. |
