/** Where a browser has no idle callback (Safari), deferred work waits this long instead. */
const IDLE_FALLBACK_MS = 2000;

/**
 * Runs `work` once the page is idle (after what it's drawing and loading now), for work a learner
 * may want next but isn't asking for yet. Returns the way to cancel it.
 */
export function runWhenIdle(work: () => void): () => void {
  if (!("requestIdleCallback" in globalThis)) {
    const timer = setTimeout(work, IDLE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }

  const idle = requestIdleCallback(work);
  return () => cancelIdleCallback(idle);
}
