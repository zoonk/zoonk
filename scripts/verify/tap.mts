import { type Page } from "@playwright/test";
import { markLinkTo } from "./probe.mts";
import { pathOf } from "./requests.mts";
import { VIEWPORTS, type ViewportName } from "./viewports.mts";

export const LOAD_TIMEOUT_MS = 60_000;

/** Without a visible link to `to`, it loads `to` directly and returns false. */
export async function tapTo({
  baseUrl,
  page,
  to,
  viewport,
}: {
  baseUrl: string;
  page: Page;
  to: string;
  viewport: ViewportName;
}): Promise<boolean> {
  const url = new URL(to, baseUrl);
  const destination = pathOf(url);
  const linkFound = await page.evaluate(markLinkTo, destination);

  if (!linkFound) {
    await page.goto(url.toString(), { timeout: LOAD_TIMEOUT_MS, waitUntil: "load" });
    return false;
  }

  const link = page.locator("[data-zoonk-verify-target]").first();
  await (VIEWPORTS[viewport].hasTouch ? link.tap() : link.click());

  await page
    .waitForURL((current) => pathOf(current) === destination, { timeout: LOAD_TIMEOUT_MS })
    .catch(() => null);

  return true;
}
