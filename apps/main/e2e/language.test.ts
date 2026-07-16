import { type Locator, type Page } from "@playwright/test";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { expect, test } from "./fixtures";

/**
 * Change the language and wait for the proxy to finish canonicalizing the
 * locale-prefixed target before making assertions against the new page.
 */
async function selectLanguage({
  expectedPath,
  locale,
  page,
  selector,
}: {
  expectedPath: string;
  locale: SupportedLocale;
  page: Page;
  selector: Locator;
}) {
  await selector.selectOption(locale);
  await expect(page).toHaveURL((url) => url.pathname === expectedPath);
}

test.describe("Language settings page", () => {
  test("displays language selector with current locale", async ({ page }) => {
    await page.goto("/language");

    await expect(page.getByRole("heading", { level: 1, name: /^language$/iu })).toBeVisible();

    const selector = page.getByRole("combobox", { name: /update language/iu });
    await expect(selector).toBeVisible();
    await expect(selector).toHaveValue("en");
  });

  test("switches UI to Spanish when selected", async ({ page }) => {
    await page.goto("/language");

    const selector = page.getByRole("combobox", { name: /update language/iu });

    await selectLanguage({ expectedPath: "/es/language", locale: "es", page, selector });
    await expect(page.getByRole("heading", { level: 1, name: /^idioma$/iu })).toBeVisible();
  });

  test("switches UI to Portuguese when selected", async ({ page }) => {
    await page.goto("/language");

    const selector = page.getByRole("combobox", { name: /update language/iu });

    await selectLanguage({ expectedPath: "/pt/language", locale: "pt", page, selector });
    await expect(page.getByRole("heading", { level: 1, name: /^idioma$/iu })).toBeVisible();

    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /escolha o idioma do app que você prefere neste dispositivo/iu,
      }),
    ).toBeVisible();
  });

  test("switches UI to French when selected", async ({ page }) => {
    await page.goto("/language");

    const selector = page.getByRole("combobox", { name: /update language/iu });

    await selectLanguage({ expectedPath: "/fr/language", locale: "fr", page, selector });
    await expect(page.getByRole("heading", { level: 1, name: /^langue$/iu })).toBeVisible();
  });

  test("switches UI to German when selected", async ({ page }) => {
    await page.goto("/language");

    const selector = page.getByRole("combobox", { name: /update language/iu });

    await selectLanguage({ expectedPath: "/de/language", locale: "de", page, selector });
    await expect(page.getByRole("heading", { level: 1, name: /^sprache$/iu })).toBeVisible();
  });

  test("removes the prefix when switching back to English", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto("/language");

    const selector = page.getByRole("combobox", { name: /alterar idioma/iu });
    await selectLanguage({ expectedPath: "/language", locale: "en", page, selector });
    await expect(page.getByRole("heading", { level: 1, name: /^language$/iu })).toBeVisible();
  });

  test("renders French privacy policy", async ({ page }) => {
    await setLocale(page, "fr");
    await page.goto("/privacy");

    await expect(page).toHaveURL(/\/fr\/privacy$/u);

    await expect(
      page.getByRole("heading", { level: 1, name: /^politique de confidentialité$/iu }),
    ).toBeVisible();
  });

  test("renders German terms of service", async ({ page }) => {
    await setLocale(page, "de");
    await page.goto("/terms");

    await expect(page).toHaveURL(/\/de\/terms$/u);

    await expect(
      page.getByRole("heading", { level: 1, name: /^nutzungsbedingungen$/iu }),
    ).toBeVisible();
  });
});
