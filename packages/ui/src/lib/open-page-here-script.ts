// React may hold back a streamed boundary until its stylesheets load, which takes seconds on a slow network.
const REVEAL_WAIT_MS = 10_000;

/**
 * Runs inline as the last child of the element a server-rendered page opens at, and scrolls that
 * element into view before the browser paints it. React reveals a streamed Suspense boundary a frame
 * or more after its HTML arrives, so it waits for the change that shows the element. Serialized with
 * `toString`, so it may use only its argument and globals.
 */
function openPageAtParent(waitMs: number) {
  const element = document.currentScript?.parentElement;

  if (!element) {
    return;
  }

  const observer = new MutationObserver(() => {
    if (element.getClientRects().length > 0) {
      observer.disconnect();
      element.scrollIntoView({ behavior: "instant", block: "start" });
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), waitMs);
}

export const OPEN_PAGE_HERE_SCRIPT = `(${openPageAtParent.toString()})(${REVEAL_WAIT_MS})`;
