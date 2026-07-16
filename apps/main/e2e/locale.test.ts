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
  test("home page shows English start content", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation");

    await expect(nav.getByRole("link", { exact: true, name: "Courses" })).not.toBeVisible();
    await expect(nav.getByRole("link", { exact: true, name: "New course" })).toBeVisible();

    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("heading", { name: "What's your goal?" })).toBeVisible();
  });

  test("removes the default English prefix", async ({ page }) => {
    await page.goto("/en");

    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("heading", { name: "What's your goal?" })).toBeVisible();
  });
});

test.describe("Locale Behavior - Portuguese", () => {
  test("Portuguese home shows Portuguese start content", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto("/");

    const nav = page.getByRole("navigation");

    await expect(nav.getByRole("link", { exact: true, name: "Cursos" })).not.toBeVisible();
    await expect(nav.getByRole("link", { exact: true, name: "Novo curso" })).toBeVisible();

    await expect(page).toHaveURL(/\/pt$/u);
    await expect(page.getByRole("heading", { name: /qual é seu objetivo/iu })).toBeVisible();
  });
});

test.describe("Locale Detection", () => {
  test("ignores legacy English locale cookie when browser language is now supported", async ({
    browser,
  }) => {
    const { context, page } = await createPageWithBrowserLocale({ browser, locale: "fr-FR" });

    try {
      await setLegacyLocaleCookie({ locale: "en", page });
      await page.goto("/");

      await expect(page).toHaveURL(/\/fr$/u);
      await expect(page.getByRole("heading", { name: "Quel est ton objectif ?" })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("manual locale cookie wins over browser language detection", async ({ browser }) => {
    const { context, page } = await createPageWithBrowserLocale({ browser, locale: "fr-FR" });

    try {
      await setLocale(page, "de");
      await page.goto("/");

      await expect(page).toHaveURL(/\/de$/u);
      await expect(page.getByRole("heading", { name: "Was ist dein Ziel?" })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe("Locale Navigation", () => {
  test("clicking start navbar link keeps user in Portuguese", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto("/courses");

    await expect(page).toHaveURL(/\/pt\/courses$/u);
    await expect(page.getByRole("heading", { name: /explorar cursos/iu })).toBeVisible();

    const startLink = page
      .getByRole("navigation")
      .getByRole("link", { exact: true, name: "Novo curso" });

    await expect(startLink).toHaveAttribute("href", "/pt/start");
    await startLink.click();

    await expect(page).toHaveURL(/\/pt\/start$/u);
    await expect(page.getByRole("heading", { name: /qual é seu objetivo/iu })).toBeVisible();
  });
});
