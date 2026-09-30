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
  test("home page shows English content", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("heading", { level: 1, name: /get ready for/iu })).toBeVisible();
  });

  test("removes the default English prefix", async ({ page }) => {
    await page.goto("/en");

    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("heading", { level: 1, name: /get ready for/iu })).toBeVisible();
  });
});

test.describe("Locale Behavior - Portuguese", () => {
  test("Portuguese start page shows Portuguese content", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto("/start");

    await expect(page).toHaveURL(/\/pt\/start$/u);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt");
    await expect(page.getByRole("heading", { name: "O que você quer alcançar?" })).toBeVisible();
  });

  test("the saved locale opens the Portuguese home page", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto("/");

    await expect(page).toHaveURL(/\/pt$/u);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt");
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

  test("manual locale cookie wins over browser language detection", async ({ browser }) => {
    const { context, page } = await createPageWithBrowserLocale({ browser, locale: "fr-FR" });

    try {
      await setLocale(page, "de");
      await page.goto("/start");

      await expect(page).toHaveURL(/\/de\/start$/u);
      await expect(page.getByRole("heading", { name: "Was möchtest du erreichen?" })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe("Locale Navigation", () => {
  test("clicking courses navbar link keeps user in Portuguese", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto("/courses/science");
    await expect(page).toHaveURL(/\/pt\/courses\/science$/u);

    const coursesLink = page
      .getByRole("navigation")
      .getByRole("link", { exact: true, name: "Cursos" });

    await expect(coursesLink).toHaveAttribute("href", "/pt/courses");
    await coursesLink.click();

    await expect(page).toHaveURL(/\/pt\/courses$/u);
    await expect(page.getByRole("heading", { name: /explorar cursos/iu })).toBeVisible();
  });

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
    await expect(page.getByRole("heading", { name: "O que você quer alcançar?" })).toBeVisible();
  });
});
