function reloadPage() {
  globalThis.location.reload();
}

/**
 * What "Try again" does on a page that failed: it renders the page again, unless a part of the
 * page loaded on its own (`next/dynamic`) failed to load, offline for a moment. React keeps that
 * part failed for as long as the page lives, so rendering again would fail again: the page
 * reloads instead.
 */
export function getPageRetry({ error, retry }: { error: Error; retry: () => void }) {
  return error.name === "ChunkLoadError" ? reloadPage : retry;
}
