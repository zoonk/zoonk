import { expect, test } from "./fixtures";

test.describe("Settings page", () => {
  test("displays correct heading and description", async ({ page }) => {
    await page.goto("/settings");

    await expect(
      page.getByRole("heading", { level: 1, name: /settings/i }),
    ).toBeVisible();

    await expect(page.getByText(/manage your account settings/i)).toBeVisible();
  });

  test("settings list items match dropdown items except Settings link", async ({
    page,
  }) => {
    await page.goto("/settings");

    // Open dropdown to get all menu items dynamically (source of truth)
    await page.getByRole("button", { name: /settings/i }).click();

    // Wait for dropdown to be fully rendered (Settings item should always be visible)
    const settingsMenuItem = page.getByRole("menuitem", {
      name: /^settings$/i,
    });

    await expect(settingsMenuItem).toBeVisible();

    // Now get all menu items
    const menuItems = page.getByRole("menuitem");
    const menuItemsCount = await menuItems.count();

    // Collect dropdown labels dynamically
    const dropdownLabels = await Promise.all(
      Array.from({ length: menuItemsCount }, (_, i) =>
        menuItems.nth(i).innerText(),
      ),
    );

    // Close dropdown
    await page.keyboard.press("Escape");

    // Expected list items = dropdown items minus "Settings"
    const expectedListLabels = dropdownLabels.filter(
      (label) => label.toLowerCase() !== "settings",
    );

    // Verify each dropdown item (except Settings) has a corresponding link on the page
    // This catches: someone adds to dropdown but forgets the settings list
    await Promise.all(
      expectedListLabels.map((label) =>
        expect(
          page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }),
        ).toBeVisible(),
      ),
    );

    // Verify there's exactly one more dropdown item than list items (the Settings link)
    // This helps catch: someone adds to list but forgets the dropdown
    expect(dropdownLabels.length).toBe(expectedListLabels.length + 1);
  });

  test("Settings item is active in dropdown when on settings page", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: /settings/i }).click();

    // The Settings menu item should be highlighted/active
    const settingsItem = page.getByRole("menuitem", { name: /^settings$/i });
    await expect(settingsItem).toHaveClass(/bg-accent/);
  });

  test("Subscription link navigates to subscription page", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: /subscription/i }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /subscription/i }),
    ).toBeVisible();
  });

  test("Language link navigates to language page", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: /language/i }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /language/i }),
    ).toBeVisible();
  });

  test("Display name link navigates to name page", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: /display name/i }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /display name/i }),
    ).toBeVisible();
  });

  test("Support link navigates to support page", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: /support/i }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /help.*support/i }),
    ).toBeVisible();
  });
});
