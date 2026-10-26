import { type Page, expect, test } from "./fixtures";
import { openAsGuest } from "./guest-session";

/** Opens the user menu, again until the client has hydrated its trigger. */
async function openUserMenu(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: /user menu/iu }).click();
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 1000 });
  }).toPass();
}

test.describe("User menu - Guest", () => {
  test("a guest's menu offers an account instead of signing out", async ({ browser }) => {
    const { context, page } = await openAsGuest(browser);
    await page.goto("/buddy");

    await openUserMenu(page);

    // Signing out would leave the guest's progress in an account nobody can sign back into.
    await expect(page.getByRole("menuitem", { name: "Create an account" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Log out" })).toHaveCount(0);

    await context.close();
  });
});
