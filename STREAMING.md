# Streaming BaltFut (OBS) — keeping the score fresh

When BaltFut is captured in OBS and the streamer switches to another app/tab,
the browser window becomes **hidden or occluded**. Chrome then does two things
that make the captured score look frozen:

1. **Timer throttling** — background tabs get `setInterval`/`setTimeout` clamped
   (to ~1/min after 5 min), so polling slows down (the *data* goes stale).
2. **Paint suspension / occlusion** — the compositor stops producing new frames
   for a hidden/covered window, so OBS keeps capturing the **last painted
   frame** (the *pixels* freeze). On Windows, Chrome's native-occlusion
   detection halts rendering entirely for a fully-covered window.

ge.globo doesn't freeze because it always has a **playing `<video>`**, which
forces the compositor to keep emitting frames.

## What the app already does (no setup needed)

- **Keep-alive video** (`KeepAlive`): a tiny, always-playing muted video (the
  thin green "live" line at the bottom edge). It keeps the compositor painting,
  so the captured score stays fresh instead of freezing — the ge.globo trick,
  built in.
- **Modo Streamer**: reloads the page on a short cadence while visible, recovers
  from post-deploy chunk errors, and holds the last frame when hidden.
- **Snap-on-visible**: the moment the tab is shown again it refetches instead of
  waiting for the next (throttled) poll.

The keep-alive video fixes the **paint** layer in-app. For a **fully-occluded**
window on Windows, also do the one-time OBS setting below — that's the other
half, and the combination solves it for good.

## One-time OBS setting (the important one)

Set the capture to **Windows Graphics Capture**, not BitBlt:

- **Window Capture** source → Properties → **Capture Method: Windows 10 (1903+)
  [Windows Graphics Capture]**.

WGC renders and captures the target window **even when it's occluded**; the
legacy BitBlt method fails on covered windows (this is the classic grey/frozen
capture). This single change fixes the occlusion freeze for any site.

## Optional: Chrome launch flags (belt-and-suspenders, fixes any site)

Launch Chrome/Edge/Brave (edit the shortcut / launch args) with:

```
--disable-features=CalculateNativeWinOcclusion
--disable-background-timer-throttling
--disable-backgrounding-occluded-windows
--disable-renderer-backgrounding
```

`CalculateNativeWinOcclusion` is the big one — it stops the browser from halting
rendering when another window covers it. (In recent Chrome the chrome://flags
entry was removed, so the command-line flag is the reliable route.)

Do **not** rely on `navigator.wakeLock` (keeps the screen awake, does not
unthrottle a hidden tab) and never add `if (document.hidden) return` to "save
resources" — that's the opposite of what a capture needs.

## Possible future hardening (not built yet)

- **Score polling in a Web Worker** — worker timers aren't subject to the
  main-thread visibility throttle, so the *data* would stay full-rate even while
  hidden (the keep-alive video only addresses paint; data still slows when
  hidden). A contained change: a worker fetches the ESPN scoreboard on an
  interval and posts it back.
- **OBS Browser Source overlay** (`?overlay=...`) — a dedicated scoreboard URL
  added as an OBS *Browser Source* runs its own embedded Chromium that renders
  off-screen continuously: no visibility throttling or occlusion, ever. The
  bulletproof option **if** you only need the scoreboard on screen (not the
  whole site). WebSocket/SSE push is **not** an option here — the app is a static
  GitHub Pages site with no server; the score comes from ESPN's REST API.
