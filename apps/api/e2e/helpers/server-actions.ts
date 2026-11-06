import { type Locator, type Route } from "@playwright/test";
import { expectHydrated } from "@zoonk/e2e/hydration";

const AUTH_PAGES = "**/auth/**";

/** Only the click's Server Action fails; later ones go through. */
export async function clickWithConnectionDown(submit: Locator): Promise<void> {
  const page = submit.page();

  const drop = async (route: Route) => {
    if (!route.request().headers()["next-action"]) {
      await route.fallback();
      return;
    }

    await route.abort("internetdisconnected");
    await page.unroute(AUTH_PAGES, drop);
  };

  await expectHydrated(submit);
  await page.route(AUTH_PAGES, drop);
  await submit.click();
}
