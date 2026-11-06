import { type Page, type Route } from "@playwright/test";

const AUTH_PAGES = "**/auth/**";

/** Fails the page's next Server Action the way a dropped connection does; later ones go through. */
export async function dropNextServerAction(page: Page): Promise<void> {
  const drop = async (route: Route) => {
    if (!route.request().headers()["next-action"]) {
      await route.fallback();
      return;
    }

    await route.abort("internetdisconnected");
    await page.unroute(AUTH_PAGES, drop);
  };

  await page.route(AUTH_PAGES, drop);
}
