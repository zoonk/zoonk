import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { expect, test } from "./fixtures";

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

    // Start listening for the reload before triggering it
    const reloadPromise = page.waitForEvent("load");
    await selector.selectOption("es");
    await reloadPromise;

    await expect(page.getByRole("heading", { level: 1, name: /^idioma$/iu })).toBeVisible();
  });

  test("switches UI to Portuguese when selected", async ({ page }) => {
    await page.goto("/language");

    const selector = page.getByRole("combobox", { name: /update language/iu });

    // Start listening for the reload before triggering it
    const reloadPromise = page.waitForEvent("load");
    await selector.selectOption("pt");
    await reloadPromise;

    await expect(page.getByRole("heading", { level: 1, name: /^idioma$/iu })).toBeVisible();

    await expect(
      page.getByText(/escolha o idioma do aplicativo que você prefere para este dispositivo/iu),
    ).toBeVisible();
  });

  test("switches UI to French when selected", async ({ page }) => {
    await page.goto("/language");

    const selector = page.getByRole("combobox", { name: /update language/iu });

    const reloadPromise = page.waitForEvent("load");
    await selector.selectOption("fr");
    await reloadPromise;

    await expect(page.getByRole("heading", { level: 1, name: /^langue$/iu })).toBeVisible();
  });

  test("switches UI to German when selected", async ({ page }) => {
    await page.goto("/language");

    const selector = page.getByRole("combobox", { name: /update language/iu });

    const reloadPromise = page.waitForEvent("load");
    await selector.selectOption("de");
    await reloadPromise;

    await expect(page.getByRole("heading", { level: 1, name: /^sprache$/iu })).toBeVisible();
  });

  test("renders French privacy policy", async ({ page }) => {
    await setLocale(page, "fr");
    await page.goto("/privacy");

    await expect(
      page.getByRole("heading", { level: 1, name: /^politique de confidentialité$/iu }),
    ).toBeVisible();
  });

  test("renders German terms of service", async ({ page }) => {
    await setLocale(page, "de");
    await page.goto("/terms");

    await expect(
      page.getByRole("heading", { level: 1, name: /^nutzungsbedingungen$/iu }),
    ).toBeVisible();
  });
});
