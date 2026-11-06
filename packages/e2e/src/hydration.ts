import { type Locator, type Page, type Route, expect } from "@playwright/test";

/** React marks every node it hydrates with `__react` keys. */
function isHydrated(locator: Locator): Promise<boolean> {
  return locator.evaluate((node) => Object.keys(node).some((key) => key.startsWith("__react")));
}

export async function expectHydrated(locator: Locator) {
  await expect.poll(() => isHydrated(locator)).toBe(true);
}

function isScript(url: URL): boolean {
  return url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js");
}

/** Until the returned function runs, a page that loads is on screen but not hydrated, as on a slow phone. */
export async function holdScripts(page: Page): Promise<() => Promise<void>> {
  const held: Route[] = [];

  const hold = (route: Route) => {
    held.push(route);
  };

  await page.route(isScript, hold);

  return async () => {
    await page.unroute(isScript, hold);
    await Promise.all(held.map((route) => route.fallback()));
  };
}
