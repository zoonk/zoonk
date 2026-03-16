import { expect, test } from "./fixtures";

test.describe("Language settings page", () => {
  test("displays language selector with current locale", async ({ page }) => {
    await page.goto("/language");

    await expect(page.getByRole("heading", { level: 1, name: /^language$/i })).toBeVisible();

    const selector = page.getByRole("combobox", { name: /update language/i });
    await expect(selector).toBeVisible();
    await expect(selector).toHaveValue("en");
  });

  test("switches UI to Spanish when selected", async ({ page }) => {
    await page.goto("/language");

    const selector = page.getByRole("combobox", { name: /update language/i });

    // Start listening for the reload before triggering it
    const reloadPromise = page.waitForEvent("load");
    await selector.selectOption("es");
    await reloadPromise;

    await expect(page.getByRole("heading", { level: 1, name: /^idioma$/i })).toBeVisible();
  });

  test("switches UI to Portuguese when selected", async ({ page }) => {
    await page.goto("/language");

    const selector = page.getByRole("combobox", { name: /update language/i });

    // Start listening for the reload before triggering it
    const reloadPromise = page.waitForEvent("load");
    await selector.selectOption("pt");
    await reloadPromise;

    await expect(page.getByRole("heading", { level: 1, name: /^idioma$/i })).toBeVisible();

    await expect(
      page.getByText(/escolha o idioma do aplicativo que você prefere para este dispositivo/i),
    ).toBeVisible();
  });
});
