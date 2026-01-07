import { expect, type Page, test } from "./fixtures";

async function openOrgDropdown(page: Page) {
  await page.getByRole("button", { name: /organizations|ai/i }).click();
}

async function openLanguageSubmenu(page: Page) {
  await openOrgDropdown(page);

  const languageMenuItem = page.getByRole("menuitem", { name: /language/i });
  const englishMenuItem = page.getByRole("menuitem", { name: "English" });

  // Use keyboard navigation to open submenu reliably.
  // Arrow keys work consistently with Base UI menus.
  await languageMenuItem.focus();
  await page.keyboard.press("ArrowRight");

  // Wait for submenu to appear
  await expect(englishMenuItem).toBeVisible();
}

test.describe("Locale Switcher", () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/ai");
  });

  test("switching locale updates page content", async ({
    authenticatedPage,
  }) => {
    await openLanguageSubmenu(authenticatedPage);

    // Switch to Portuguese - force click since submenu animations may cause instability
    const portugueseItem = authenticatedPage.getByRole("menuitem", {
      name: "Português",
    });

    await portugueseItem.click({ force: true });
    await authenticatedPage.waitForLoadState("domcontentloaded");

    // Reopen to verify the Language menu item text changed
    await openOrgDropdown(authenticatedPage);

    await expect(
      authenticatedPage.getByRole("menuitem", { name: /idioma/i }),
    ).toBeVisible();
  });

  test("marks currently selected locale with aria-current", async ({
    authenticatedPage,
  }) => {
    await openLanguageSubmenu(authenticatedPage);

    // English should be marked as current (default locale)
    const englishItem = authenticatedPage.getByRole("menuitem", {
      name: "English",
    });
    await expect(englishItem).toHaveAttribute("aria-current", "true");

    // Other locales should not be marked as current
    const portugueseItem = authenticatedPage.getByRole("menuitem", {
      name: "Português",
    });
    await expect(portugueseItem).not.toHaveAttribute("aria-current", "true");
  });

  test("persists locale selection after page refresh", async ({
    authenticatedPage,
  }) => {
    await openLanguageSubmenu(authenticatedPage);

    // Switch to Spanish - force click since submenu animations may cause instability
    const spanishItem = authenticatedPage.getByRole("menuitem", {
      name: "Español",
    });

    await spanishItem.click({ force: true });
    await authenticatedPage.waitForLoadState("domcontentloaded");

    // Refresh the page
    await authenticatedPage.reload();

    // Verify the locale persisted by checking the Language menu text
    await openOrgDropdown(authenticatedPage);

    await expect(
      authenticatedPage.getByRole("menuitem", { name: /idioma/i }),
    ).toBeVisible();
  });
});
