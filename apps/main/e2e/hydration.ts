import { type Locator, expect } from "@playwright/test";

/** Whether React has hydrated what `locator` finds (it marks every node it takes over). */
function isHydrated(locator: Locator): Promise<boolean> {
  return locator.evaluate((node) => Object.keys(node).some((key) => key.startsWith("__react")));
}

/** Waits until React has hydrated what `locator` finds, so a tap on it is the page's to handle. */
export async function expectHydrated(locator: Locator) {
  await expect.poll(() => isHydrated(locator)).toBe(true);
}
