import { type Page } from "@playwright/test";
import { holdStill } from "./states-wait.mts";
import { LOAD_TIMEOUT_MS } from "./tap.mts";

/**
 * Only what reads: a write is aborted, so nothing the walk does changes data or starts AI. While the
 * page loads it sends what its load sends (a lesson records its start), as the measured load did,
 * so the walk acts on the page a learner sees rather than its failed-save state.
 */
const READS = new Set(["GET", "HEAD", "OPTIONS"]);

export type WriteGuard = { blocked: () => number; loading: (on: boolean) => void };

export async function guardWrites(page: Page): Promise<WriteGuard> {
  let blocked = 0;
  let loading = false;

  await page.route("**/*", async (route) => {
    if (loading || READS.has(route.request().method())) {
      await route.continue();
      return;
    }

    blocked += 1;
    await route.abort();
  });

  return {
    blocked: () => blocked,
    loading: (on) => {
      loading = on;
    },
  };
}

/** Loads the page with its own writes let through, and waits until it holds still. */
export async function loadPage(page: Page, url: string, guard: WriteGuard) {
  guard.loading(true);

  try {
    await page.goto(url, { timeout: LOAD_TIMEOUT_MS });
    await page.waitForLoadState("networkidle").catch(() => null);
    await holdStill(page);
  } finally {
    guard.loading(false);
  }
}
