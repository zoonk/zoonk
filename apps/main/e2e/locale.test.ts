import { type Browser, type Page } from "@playwright/test";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { expect, test } from "./fixtures";

/**
 * Recreate the old fallback cookie without using the new locale fixture. This
 * proves a stale cookie from before the manual-override rename cannot block
 * browser language detection after a language becomes supported.
 */
async function setLegacyLocaleCookie({ locale, page }: { locale: string; page: Page }) {
  await page
    .context()
    .addCookies([{ domain: "localhost", name: "NEXT_LOCALE", path: "/", value: locale }]);
}

/**
 * Create a page with a real browser locale because that is how Playwright sets
 * the Accept-Language header used by server-side locale negotiation.
 */
async function createPageWithBrowserLocale({
  browser,
  locale,
}: {
  browser: Browser;
  locale: string;
}) {
  const context = await browser.newContext({ locale });
  const page = await context.newPage();

  return { context, page };
}

test.describe("Locale Behavior - English", () => {
  test("removes the default English prefix", async ({ page }) => {
    await page.goto("/en");

    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("heading", { level: 1, name: /get ready for/iu })).toBeVisible();
  });
});

test.describe("Locale Detection", () => {
  test("ignores legacy English locale cookie when browser language is now supported", async ({
    browser,
  }) => {
    const { context, page } = await createPageWithBrowserLocale({ browser, locale: "fr-FR" });

    try {
      await setLegacyLocaleCookie({ locale: "en", page });
      await page.goto("/start");

      await expect(page).toHaveURL(/\/fr\/start$/u);

      await expect(
        page.getByRole("heading", { name: "Qu'est-ce que tu veux accomplir ?" }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe("Locale Navigation", () => {
  test("the public header's links keep the visitor in Portuguese", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto("/privacy");
    await expect(page).toHaveURL(/\/pt\/privacy$/u);

    const login = page.getByRole("link", { exact: true, name: "Entrar" });
    await expect(login).toHaveAttribute("href", /^\/pt\/login/u);

    const home = page.getByRole("link", { name: "Página inicial do Zoonk" });
    await expect(home).toHaveAttribute("href", "/pt");
    await home.click();

    await expect(page).toHaveURL(/\/pt$/u);
  });
});
