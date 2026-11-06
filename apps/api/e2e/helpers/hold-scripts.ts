import { type Page, type Route } from "@playwright/test";

function isScript(url: URL): boolean {
  return url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js");
}

/** Until the returned function runs, a page that loads is on screen but not hydrated. */
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
