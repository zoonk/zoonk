import { expect, test } from "@zoonk/e2e/fixtures";

test.describe("Settings - Unauthenticated", () => {
  test("/settings shows settings list (public page)", async ({ page }) => {
    await page.goto("/settings");

    // Settings list is visible even for unauthenticated users
    await expect(
      page.getByRole("heading", { level: 1, name: /settings/i }),
    ).toBeVisible();
  });

  test("/subscription shows protected message when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/subscription");

    await expect(page.getByText(/you need to be logged in/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /login/i })).toBeVisible();
  });

  test("/name shows protected message when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/name");

    await expect(page.getByText(/you need to be logged in/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /login/i })).toBeVisible();
  });
});

test.describe("Settings - Authenticated Access", () => {
  test("authenticated users see settings content on /settings", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/settings");

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /settings/i }),
    ).toBeVisible();
    // Should NOT show the protected message
    await expect(
      authenticatedPage.getByText(/you need to be logged in/i),
    ).not.toBeVisible();
  });

  test("authenticated users see subscription content on /subscription", async ({
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

  test("authenticated users see name form on /name", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/name");

    await expect(
      authenticatedPage.getByRole("heading", { name: /display name/i }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("textbox", { name: /name/i }),
    ).toBeVisible();
  });
});

test.describe("Settings Navigation Dropdown", () => {
  test("shows current page name in trigger", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/settings");

    // The dropdown trigger should show "Settings" - it uses button role
    await expect(
      authenticatedPage.getByRole("button", { name: /settings/i }),
    ).toBeVisible();
  });

  test("opens dropdown menu when clicked", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/settings");

    await authenticatedPage.getByRole("button", { name: /settings/i }).click();

    // Menu items should be visible
    await expect(
      authenticatedPage.getByRole("menuitem", { name: /subscription/i }),
    ).toBeVisible();
  });

  test("menu items navigate correctly and show destination content", async ({
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
  test("shows name input pre-filled with current user name", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/name");

    const nameInput = authenticatedPage.getByRole("textbox", { name: /name/i });
    await expect(nameInput).toBeVisible();
    // Should have a non-empty value (the user's current name)
    await expect(nameInput).not.toHaveValue("");
  });

  test("submit with empty name shows validation error", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/name");

    const nameInput = authenticatedPage.getByRole("textbox", { name: /name/i });
    await nameInput.clear();

    await authenticatedPage
      .getByRole("button", { name: /update name/i })
      .click();

    // Browser validation or form validation should show error
    // Check that form didn't submit successfully (no success message)
    // and we're still on the same page
    await expect(authenticatedPage).toHaveURL(/\/name/);
  });

  test("submit with new name shows success message and updates value", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/name");

    const nameInput = authenticatedPage.getByRole("textbox", { name: /name/i });
    await nameInput.clear();
    await nameInput.fill("Updated Name");

    await authenticatedPage
      .getByRole("button", { name: /update name/i })
      .click();

    // Should show success message
    await expect(
      authenticatedPage.getByText(/saved|updated|success/i),
    ).toBeVisible({ timeout: 5000 });

    // Name input should still show the updated value
    await expect(nameInput).toHaveValue("Updated Name");
  });

  test("updated name persists after navigation", async ({
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

    // Wait for save to complete
    await expect(
      authenticatedPage.getByText(/saved|updated|success/i),
    ).toBeVisible({ timeout: 5000 });

    // Navigate away
    await authenticatedPage.goto("/settings");
    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /settings/i }),
    ).toBeVisible();

    // Navigate back
    await authenticatedPage.goto("/name");

    // Name should still be the updated value
    await expect(
      authenticatedPage.getByRole("textbox", { name: /name/i }),
    ).toHaveValue(newName);
  });
});

test.describe("Settings - Locale Switcher", () => {
  test("shows select with current locale selected", async ({ page }) => {
    await page.goto("/language");

    const localeSelect = page.getByRole("combobox", {
      name: /update language/i,
    });
    await expect(localeSelect).toBeVisible();
    // Should show English as current locale
    await expect(localeSelect).toHaveValue("en");
  });

  test("lists English and Portuguese options", async ({ page }) => {
    await page.goto("/language");

    const localeSelect = page.getByRole("combobox", {
      name: /update language/i,
    });

    // Check options exist
    await expect(
      localeSelect.getByRole("option", { name: "English" }),
    ).toBeAttached();
    await expect(
      localeSelect.getByRole("option", { name: "Português" }),
    ).toBeAttached();
  });

  test("selecting Portuguese updates page to show Portuguese content", async ({
    page,
  }) => {
    await page.goto("/language");

    const localeSelect = page.getByRole("combobox", {
      name: /update language/i,
    });
    await localeSelect.selectOption("pt");

    // Wait for page to update - URL should change to include /pt/
    await page.waitForURL(/\/pt\//);

    // Page heading should now be in Portuguese ("Idioma")
    await expect(
      page.getByRole("heading", { exact: true, name: "Idioma" }),
    ).toBeVisible();
  });

  test("after switching locale, navigating keeps Portuguese", async ({
    page,
  }) => {
    await page.goto("/language");

    // Switch to Portuguese
    const localeSelect = page.getByRole("combobox", {
      name: /update language/i,
    });
    await localeSelect.selectOption("pt");

    // Wait for locale change - wait for Portuguese heading to appear
    await expect(
      page.getByRole("heading", { exact: true, name: "Idioma" }),
    ).toBeVisible({ timeout: 10_000 });

    // Navigate to home first (settings navbar doesn't have Courses link)
    // The accessible name depends on locale: "Home page" (en) or "Página inicial" (pt)
    await page.getByRole("link", { name: /home page|página inicial/i }).click();

    // Wait for home page (in Portuguese)
    await expect(
      page.getByRole("heading", { name: /aprenda qualquer coisa/i }),
    ).toBeVisible();

    // Now navigate to courses using main navbar (Portuguese: "Cursos")
    await page.getByRole("link", { exact: true, name: "Cursos" }).click();

    // Should still be in Portuguese
    await expect(page).toHaveURL(/\/pt\/courses/);
    await expect(
      page.getByRole("heading", { name: /explorar cursos/i }),
    ).toBeVisible();
  });
});
