import { type Locator, type Page } from "@playwright/test";
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

test.describe("Language setting in Preferences", () => {
  test("switches the UI to another language and drops the prefix back in English", async ({
    page,
  }) => {
    await page.goto("/settings/appearance");

    await expect(page.getByRole("heading", { level: 1, name: "Preferences" })).toBeAttached();

    const english = page.getByRole("combobox", { name: "App language" });
    await expect(english).toHaveValue("en");

    await selectLanguage({
      expectedPath: "/pt/settings/appearance",
      locale: "pt",
      page,
      selector: english,
    });

    await expect(page.locator("html")).toHaveAttribute("lang", "pt");

    await selectLanguage({
      expectedPath: "/settings/appearance",
      locale: "en",
      page,
      selector: page.getByRole("combobox", { name: "Idioma do app" }),
    });

    await expect(page.getByRole("heading", { level: 1, name: "Preferences" })).toBeAttached();
  });
});

test.describe("Language setting saves the choice", () => {
  test("opens the site's unprefixed addresses in the language picked in Preferences", async ({
    page,
  }) => {
    await page.goto("/settings/appearance");

    await selectLanguage({
      expectedPath: "/pt/settings/appearance",
      locale: "pt",
      page,
      selector: page.getByRole("combobox", { name: "App language" }),
    });

    await page.goto("/courses");
    await expect(page).toHaveURL(/\/pt\/courses$/u);
  });
});
