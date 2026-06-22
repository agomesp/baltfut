/**
 * Poll a URL on an interval inside a Web Worker, calling `onData` with the parsed
 * JSON each time. Worker timers are NOT subject to the main-thread background-tab
 * throttle (which clamps hidden-tab timers to ~1/min after 5 minutes), so the
 * score data stays full-rate even while the streamer's window is hidden. The
 * keep-alive video keeps the page *painting*; this keeps the *data* fresh, so the
 * painted score is current rather than stale.
 *
 * Built from a Blob so it needs no separately-bundled worker file — works cleanly
 * in the static export. Returns a cleanup function that stops the worker.
 */
export function startScoreboardWorker(
  url: string,
  intervalMs: number,
  onData: (json: unknown) => void,
): () => void {
  if (typeof Worker === "undefined") return () => {};
  // Plain ES5 worker source: fetch on an interval, post the JSON back.
  const code =
    "var t;onmessage=function(e){var u=e.data.url,iv=e.data.intervalMs;" +
    "function tick(){fetch(u,{headers:{accept:'application/json'}})" +
    ".then(function(r){return r.ok?r.json():null;})" +
    ".then(function(j){if(j)postMessage(j);}).catch(function(){});}" +
    "if(t)clearInterval(t);tick();t=setInterval(tick,iv);};";
  let worker: Worker;
  let objUrl = "";
  try {
    objUrl = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
    worker = new Worker(objUrl);
  } catch {
    if (objUrl) URL.revokeObjectURL(objUrl);
    return () => {};
  }
  worker.onmessage = (e: MessageEvent) => onData(e.data);
  worker.postMessage({ url, intervalMs });
  return () => {
    worker.terminate();
    if (objUrl) URL.revokeObjectURL(objUrl);
  };
}
