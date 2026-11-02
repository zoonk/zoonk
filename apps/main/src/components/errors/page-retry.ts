function reloadPage() {
  globalThis.location.reload();
}

/** React keeps a `next/dynamic` part that failed to load failed for the page's life, so that case reloads. */
export function getPageRetry({ error, retry }: { error: Error; retry: () => void }) {
  return error.name === "ChunkLoadError" ? reloadPage : retry;
}
