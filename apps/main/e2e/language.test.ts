import { type Locator, type Page } from "@playwright/test";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { expect, test } from "./fixtures";
import { expectMode, showInMode } from "./learn-personas";

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
  test("switches the UI through every language and drops the prefix back in English", async ({
    page,
  }) => {
    await page.goto("/language");

    await expect(page.getByRole("heading", { level: 1, name: /^language$/iu })).toBeVisible();

    const english = page.getByRole("combobox", { name: /update language/iu });
    await expect(english).toHaveValue("en");
    await expectAccessibleScreen(page, "the language settings");

    await selectLanguage({ expectedPath: "/pt/language", locale: "pt", page, selector: english });
    await expect(page.getByRole("heading", { level: 1, name: /^idioma$/iu })).toBeVisible();

    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /escolha o idioma do app que você prefere neste dispositivo/iu,
      }),
    ).toBeVisible();

    await selectLanguage({
      expectedPath: "/fr/language",
      locale: "fr",
      page,
      selector: page.getByRole("combobox", { name: /alterar idioma/iu }),
    });

    await expect(page.getByRole("heading", { level: 1, name: /^langue$/iu })).toBeVisible();

    await selectLanguage({
      expectedPath: "/de/language",
      locale: "de",
      page,
      selector: page.getByRole("combobox", { name: /changer la langue/iu }),
    });

    await expect(page.getByRole("heading", { level: 1, name: /^sprache$/iu })).toBeVisible();

    await selectLanguage({
      expectedPath: "/language",
      locale: "en",
      page,
      selector: page.getByRole("combobox", { name: /sprache ändern/iu }),
    });

    await expect(page.getByRole("heading", { level: 1, name: /^language$/iu })).toBeVisible();
  });

  test("renders the French privacy policy and the German terms of service", async ({ page }) => {
    await setLocale(page, "fr");
    await page.goto("/privacy");

    await expect(page).toHaveURL(/\/fr\/privacy$/u);

    await expect(
      page.getByRole("heading", { level: 1, name: /^politique de confidentialité$/iu }),
    ).toBeVisible();

    await expectAccessibleScreen(page, "the privacy policy");

    await setLocale(page, "de");
    await page.goto("/terms");

    await expect(page).toHaveURL(/\/de\/terms$/u);

    await expect(
      page.getByRole("heading", { level: 1, name: /^nutzungsbedingungen$/iu }),
    ).toBeVisible();

    await expectAccessibleScreen(page, "the terms of service");
  });
});

test.describe("Language settings in Fun", () => {
  test("a Fun learner switches the app language and stays in Fun", async ({
    browser,
    noProgressUser,
  }) => {
    const context = await browser.newContext({ storageState: noProgressUser.storageState });
    await showInMode(context, { mode: "fun", userId: noProgressUser.id });
    const page = await context.newPage();

    await page.goto("/language");
    await expectMode(page, "fun");
    await expectAccessibleScreen(page, "the Fun language settings");

    const selector = page.getByRole("combobox", { name: /update language/iu });

    await selectLanguage({ expectedPath: "/es/language", locale: "es", page, selector });
    await expect(page.getByRole("heading", { level: 1, name: /^idioma$/iu })).toBeVisible();
    await expectMode(page, "fun");

    await context.close();
  });
});
