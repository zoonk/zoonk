import { expect, type Page, test } from "./fixtures";

async function openOrgDropdown(page: Page) {
  await page.getByRole("button", { name: /organizations|ai/i }).click();
}

test.describe("Logout Menu Item", () => {
  test("logs out user and shows login button", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/ai");

    await openOrgDropdown(authenticatedPage);
    await authenticatedPage.getByRole("menuitem", { name: /logout/i }).click();

    // After logout (hard navigation), user should see the login button
    await authenticatedPage.waitForURL("/");
    await expect(authenticatedPage.getByRole("link", { name: /login/i })).toBeVisible();
  });
});
