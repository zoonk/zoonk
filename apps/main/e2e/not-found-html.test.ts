import { randomUUID } from "node:crypto";
import { type Browser, type BrowserContextOptions } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expect, test } from "./fixtures";
import { getServedPage } from "./served-page";

const MESSAGE = "We couldn't find this page";

/**
 * A browser that runs the page's own inline scripts (the ones that put streamed parts in place)
 * but never loads the app's: what a learner sees before the app has loaded, or if it never does.
 */
async function openWithoutAppScripts(browser: Browser, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  await context.route("**/_next/static/**/*.js", (route) => route.abort());
  return context;
}

test.describe("Pages with nothing to show", () => {
  test("a missing task, Plan page, onboarding or shared plan says so in the page's HTML, without waiting for the app", async ({
    browser,
  }) => {
    const learner = await createE2EUser(getBaseURL());

    // One address per route group whose pages are drawn per request: each sends its loading
    // placeholder first, then the group's not-found message in its place.
    const addresses = [
      { path: `/checkpoint/${randomUUID()}`, signedIn: true },
      { path: `/content/chapters/${randomUUID()}`, signedIn: true },
      { path: `/start/${randomUUID()}`, signedIn: true },
      { path: `/plan-link/${randomUUID()}`, signedIn: false },
    ];

    for (const { path, signedIn } of addresses) {
      const options = signedIn ? { storageState: learner.storageState } : {};
      // oxlint-disable-next-line no-await-in-loop -- One address at a time keeps failures readable.
      const context = await openWithoutAppScripts(browser, options);
      // oxlint-disable-next-line no-await-in-loop -- Same.
      const page = await context.newPage();

      try {
        // oxlint-disable-next-line no-await-in-loop -- Same.
        const served = await getServedPage(page, path);
        expect(served.headings, path).toContain(MESSAGE);

        // oxlint-disable-next-line no-await-in-loop -- Same.
        await page.goto(path);

        // oxlint-disable-next-line no-await-in-loop -- Same.
        await expect(page.getByRole("heading", { level: 1, name: MESSAGE })).toBeVisible();

        // The message stands in the page's own frame, not in a second one inside it.
        // oxlint-disable-next-line no-await-in-loop -- Same.
        await expect(page.getByRole("main")).toHaveCount(1);

        // oxlint-disable-next-line no-await-in-loop -- Same.
        await expect(
          page.locator('main [data-slot="skeleton"]').filter({ visible: true }),
        ).toHaveCount(0);
      } finally {
        // oxlint-disable-next-line no-await-in-loop -- Same.
        await context.close();
      }
    }
  });

  test("a missing course's page shows its message with no scripts at all", async ({ browser }) => {
    // The catalog's pages are static: the message is in the page itself, with a 404.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    try {
      const response = await page.goto(`/b/no-brand-${randomUUID().slice(0, 8)}/c/no-course`);

      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: MESSAGE })).toBeVisible();
      await expect(page.getByRole("link", { name: "Explore courses" }).first()).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
