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

/**
 * Where to tap with `page.mouse`. Measure before the tap: once a tap starts loading another page,
 * every locator waits for that page.
 */
export async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("The element to tap isn't on screen");
  }

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
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
