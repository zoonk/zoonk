import { expect, test } from "./fixtures";

test.describe("Settings - Unauthenticated", () => {
  test("/settings is publicly accessible", async ({ page }) => {
    await page.goto("/settings");

    await expect(
      page.getByRole("heading", { level: 1, name: /settings/i }),
    ).toBeVisible();
  });

  test("protected routes show login prompt", async ({ page }) => {
    await page.goto("/subscription");
    await expect(page.getByText(/you need to be logged in/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /login/i })).toBeVisible();
  });
});

test.describe("Settings - Authenticated", () => {
  test("authenticated users can access protected routes", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/subscription");

    await expect(
      authenticatedPage.getByRole("heading", {
        level: 1,
        name: /subscription/i,
      }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText(/you need to be logged in/i),
    ).not.toBeVisible();
  });

  test("settings dropdown navigates between pages", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/settings");

    await authenticatedPage.getByRole("button", { name: /settings/i }).click();
    await authenticatedPage
      .getByRole("menuitem", { name: /subscription/i })
      .click();

    await expect(
      authenticatedPage.getByRole("heading", {
        level: 1,
        name: /subscription/i,
      }),
    ).toBeVisible();
  });
});

test.describe("Settings - Name Form", () => {
  test("updating name shows success and persists", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/name");

    const nameInput = authenticatedPage.getByRole("textbox", { name: /name/i });
    const newName = `Test Name ${Date.now()}`;

    await nameInput.clear();
    await nameInput.fill(newName);
    await authenticatedPage
      .getByRole("button", { name: /update name/i })
      .click();

    await expect(
      authenticatedPage.getByText(/saved|updated|success/i),
    ).toBeVisible({ timeout: 5000 });

    // Navigate away and back
    await authenticatedPage.goto("/settings");
    await authenticatedPage.goto("/name");

    await expect(
      authenticatedPage.getByRole("textbox", { name: /name/i }),
    ).toHaveValue(newName);
  });
});

test.describe("Settings - Locale Switcher", () => {
  test("switching locale updates content and persists on navigation", async ({
    page,
  }) => {
    await page.goto("/language");

    const localeSelect = page.getByRole("combobox", {
      name: /update language/i,
    });
    await expect(localeSelect).toHaveValue("en");

    // Switch to Portuguese
    await localeSelect.selectOption("pt");
    await page.waitForURL(/\/pt\//);

    await expect(
      page.getByRole("heading", { exact: true, name: "Idioma" }),
    ).toBeVisible();

    // Navigate to courses and verify locale persists
    await page.getByRole("link", { name: /home page|página inicial/i }).click();
    await page.getByRole("link", { exact: true, name: "Cursos" }).click();

    await expect(page).toHaveURL(/\/pt\/courses/);
    await expect(
      page.getByRole("heading", { name: /explorar cursos/i }),
    ).toBeVisible();
  });
});
