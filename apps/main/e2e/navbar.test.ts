import { type Page, expect, test } from "./fixtures";
import { openAsGuest } from "./guest-session";

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

    await expect(page.getByRole("menuitem", { name: "Create an account" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Log out" })).toHaveCount(0);

    await context.close();
  });
});
