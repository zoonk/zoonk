import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Page, expect, test } from "./fixtures";

async function openOrgDropdown(page: Page) {
  await page.getByRole("button", { name: /organizations|ai/i }).click();
}

test.describe("Logout Menu Item", () => {
  // Logout invalidates the server-side session, making the worker-scoped
  // adminUser's storageState stale on retry. Use a test-scoped user instead.
  test("logs out user and shows login button", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL(), {
      orgRole: "admin",
      withSubscription: true,
    });
    const ctx = await browser.newContext({ storageState: user.storageState });
    const page = await ctx.newPage();

    await page.goto(`/${AI_ORG_SLUG}`);

    await openOrgDropdown(page);

    const logoutItem = page.getByRole("menuitem", { name: /logout/i });
    await expect(logoutItem).toBeVisible();
    await logoutItem.click({ force: true });

    // After logout (hard navigation), user should see the login button
    await page.waitForURL("/");
    await expect(page.getByRole("link", { name: /login/i })).toBeVisible();

    await ctx.close();
  });
});
