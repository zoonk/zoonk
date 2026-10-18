import { type Page, type Request } from "@playwright/test";

/**
 * Resolves once the router has read a link's runtime prefetch of `path` (`next-router-prefetch:
 * 2`, the learner's own facts behind the link). The router reads that answer only up to the length
 * it needs and then cancels the rest (`reader.cancel()` in `bufferPrefetchResponseBody`,
 * next/dist/client/components/segment-cache/cache.js), so the browser reports the request failed,
 * not finished: either event means it was read. Its response arriving isn't enough: a tap then can
 * land while the body is still being read. Set it up before what prefetches the link.
 */
export function runtimePrefetchRead(page: Page, path: string): Promise<void> {
  return new Promise((resolve) => {
    const settle = (request: Request) => {
      if (
        new URL(request.url()).pathname === path &&
        request.headers()["next-router-prefetch"] === "2"
      ) {
        page.off("requestfinished", settle);
        page.off("requestfailed", settle);
        resolve();
      }
    };

    page.on("requestfinished", settle);
    page.on("requestfailed", settle);
  });
}
