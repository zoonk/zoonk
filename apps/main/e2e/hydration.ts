import { type Locator, expect } from "@playwright/test";

/** React marks every node it hydrates with `__react` keys. */
function isHydrated(locator: Locator): Promise<boolean> {
  return locator.evaluate((node) => Object.keys(node).some((key) => key.startsWith("__react")));
}

export async function expectHydrated(locator: Locator) {
  await expect.poll(() => isHydrated(locator)).toBe(true);
}
