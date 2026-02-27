import { createE2EUser, generateOneTimeToken, getBaseURL } from "@zoonk/e2e/helpers";
import { expect, test } from "./fixtures";

test.describe("Auth Callback", () => {
  test("redirects to home and sets session on valid token", async ({ browser }) => {
    const baseURL = getBaseURL();
    const user = await createE2EUser(baseURL);
    const token = await generateOneTimeToken(baseURL, user);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(`${baseURL}/auth/callback/${token}`);
    await page.waitForURL(/\/$/);

    await page.getByRole("button", { name: /user menu/i }).click();
    await expect(page.getByText(/logout/i)).toBeVisible();

    await ctx.close();
  });

  test("redirects to login on invalid token", async ({ page }) => {
    await page.goto("/auth/callback/invalid-token-abc");
    await page.waitForURL(/login/);
  });
});
