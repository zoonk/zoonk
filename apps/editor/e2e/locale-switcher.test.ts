import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Page, expect, test } from "./fixtures";

/**
 * Retry-click the org dropdown trigger until the menu appears.
 * The first click can be lost if it lands before React hydration
 * attaches the event handler (same pattern as openDialog in e2e helpers).
 */
async function openOrgDropdown(page: Page) {
  const trigger = page.getByRole("button", { name: /organizations|ai/i });
  const menu = page.getByRole("menu");

  await expect(async () => {
    if (!(await menu.isVisible())) {
      await trigger.click();
    }

    await expect(menu).toBeVisible({ timeout: 1000 });
  }).toPass();
}

async function openLanguageSubmenu(page: Page) {
  await openOrgDropdown(page);

  const languageMenuItem = page.getByRole("menuitem", { name: /language/i });

  // Wait for the dropdown to fully render before interacting
  await expect(languageMenuItem).toBeVisible();

  // Hover to open submenu — Base UI opens submenus on pointer enter
  await languageMenuItem.hover();

  // Wait for submenu to appear
  const englishMenuItem = page.getByRole("menuitem", { name: "English" });
  await expect(englishMenuItem).toBeVisible();
}

test.describe("Locale Switcher", () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/${AI_ORG_SLUG}`);
  });

  test("switching locale updates page content", async ({ authenticatedPage }) => {
    await openLanguageSubmenu(authenticatedPage);

    // Switch to Portuguese - force click since submenu animations may cause instability
    const portugueseItem = authenticatedPage.getByRole("menuitem", {
      name: "Português",
    });

    await portugueseItem.click({ force: true });
    await authenticatedPage.waitForLoadState("domcontentloaded");

    // Reopen to verify the Language menu item text changed
    await openOrgDropdown(authenticatedPage);

    await expect(authenticatedPage.getByRole("menuitem", { name: /idioma/i })).toBeVisible();
  });

  test("marks currently selected locale with aria-current", async ({ authenticatedPage }) => {
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

  test("persists locale selection after page refresh", async ({ authenticatedPage }) => {
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

    await expect(authenticatedPage.getByRole("menuitem", { name: /idioma/i })).toBeVisible();
  });
});
