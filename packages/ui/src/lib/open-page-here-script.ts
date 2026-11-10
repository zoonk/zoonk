/**
 * Runs inline as the last child of the element a server-rendered page opens at, and scrolls that
 * element into view before the browser paints it. React keeps a streamed Suspense boundary's HTML
 * in a `hidden` element until it reveals it, so this waits for the change that reveals it, or for
 * hydration taking this script out. Serialized with `toString`, so it may use only globals.
 */
function openPageAtParent() {
  const script = document.currentScript;
  const element = script?.parentElement;

  if (!script || !element) {
    return;
  }

  const observer = new MutationObserver(() => {
    if (!script.isConnected) {
      observer.disconnect();
    } else if (!element.closest("[hidden]")) {
      observer.disconnect();
      element.scrollIntoView({ behavior: "instant", block: "start" });
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}

export const OPEN_PAGE_HERE_SCRIPT = `(${openPageAtParent.toString()})()`;
