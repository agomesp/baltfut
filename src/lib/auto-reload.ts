/**
 * Whether the "new deploy" auto-reload is safe to fire right now. A force-reload
 * is destructive in three cases, so we only reload when none apply:
 *  - typing: mid-palpite, a reload throws away the user's input.
 *  - streaming: Modo Streamer is on — a reload blanks the live broadcast.
 *  - hidden: the tab is hidden/occluded — a reload greys an OBS capture to its
 *    background (the same rule the inline chunk-guard in layout.tsx follows).
 * Visible + idle + not streaming → safe to reload.
 */
export function shouldAutoReload(opts: { typing: boolean; streaming: boolean; hidden: boolean }): boolean {
  return !opts.typing && !opts.streaming && !opts.hidden;
}
