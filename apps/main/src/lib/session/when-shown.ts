/** The part of `document` that says whether the page is shown for real. */
type ShownDocument = Pick<Document, "addEventListener" | "visibilityState"> & {
  prerendering?: boolean;
};

/**
 * Runs `run` once the page is shown for real: never while the browser prepares it ahead (a
 * prerendered link) and only while the tab is visible, so a background tab waits for its first
 * show. The returned function stops waiting.
 */
export function whenShown(run: () => void, page: ShownDocument = document): () => void {
  const waiting = new AbortController();

  const check = () => {
    if (
      waiting.signal.aborted ||
      page.prerendering === true ||
      page.visibilityState !== "visible"
    ) {
      return;
    }

    waiting.abort();
    run();
  };

  page.addEventListener("visibilitychange", check, { signal: waiting.signal });
  page.addEventListener("prerenderingchange", check, { signal: waiting.signal });
  check();

  return () => waiting.abort();
}
