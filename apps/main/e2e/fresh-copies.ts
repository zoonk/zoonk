import { type Page } from "@playwright/test";

/**
 * Holds the browser's clock still, so each page shows a copy read moments ago and never asks
 * whether what it shows changed (`useRefreshWhenOld`; `plan-waits.test.ts` covers the ask). For a
 * test about something else that the ask would get in the way of: on a slow runner a page is
 * seconds old by the time it hydrates, a persona's rows were written within the ask's clock margin
 * just before, so the ask says it changed and the page reads itself again, dropping every link's
 * prefetch. Call it before the page opens.
 */
export function keepShownCopiesFresh(page: Page): Promise<void> {
  return page.clock.setFixedTime(new Date());
}
