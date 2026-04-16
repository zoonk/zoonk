import { type Page } from "@playwright/test";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";

/**
 * Force the app locale through the same cookie path the real product uses.
 * Tests call this when they need deterministic translated UI without going
 * through the locale switcher flow first.
 */
export async function setLocale(page: Page, locale: string) {
  await page
    .context()
    .addCookies([{ domain: "localhost", name: LOCALE_COOKIE, path: "/", value: locale }]);
}
