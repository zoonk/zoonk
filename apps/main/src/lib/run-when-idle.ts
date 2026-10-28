/** Safari has no idle callback. */
const IDLE_FALLBACK_MS = 2000;

export function runWhenIdle(work: () => void): () => void {
  if (!("requestIdleCallback" in globalThis)) {
    const timer = setTimeout(work, IDLE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }

  const idle = requestIdleCallback(work);
  return () => cancelIdleCallback(idle);
}
