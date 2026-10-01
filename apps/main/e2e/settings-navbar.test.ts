import { expect, test } from "./fixtures";
import { readDeviceMode } from "./learn-personas";

test.describe("Settings Navbar", () => {
  test("displays all settings navigation pills under the learning top bar", async ({ page }) => {
    await page.goto("/language");

    await expect(page.getByRole("link", { name: "Today" })).toBeVisible();

    const settings = page.getByRole("navigation", { name: "Settings" });

    await expect(settings.getByRole("link", { name: /subscription/iu })).toBeVisible();
    await expect(settings.getByRole("link", { name: /language/iu })).toBeVisible();
    await expect(settings.getByRole("link", { name: /profile/iu })).toBeVisible();
    await expect(settings.getByRole("link", { name: /appearance/iu })).toBeVisible();
    await expect(settings.getByRole("link", { name: /support/iu })).toBeVisible();

    // Memory needs an account, and guardian links are only for learners under 18.
    await expect(settings.getByRole("link", { name: /memory/iu })).toHaveCount(0);
    await expect(settings.getByRole("link", { name: /guardian/iu })).toHaveCount(0);
  });

  test("a direct phone visit shows the current page's pill", async ({ page }) => {
    await page.setViewportSize({ height: 812, width: 375 });
    await page.goto("/support");

    const current = page
      .getByRole("navigation", { name: "Settings" })
      .getByRole("link", { name: /support/iu });

    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(current).toBeInViewport({ ratio: 1 });
  });

  test("Subscription pill opens the public pricing page for a visitor", async ({ page }) => {
    await page.goto("/language");
    await page.getByRole("link", { name: /subscription/iu }).click();

    await expect(page).toHaveURL(/\/pricing$/u);
    await expect(page.getByRole("link", { name: "Try free" })).toBeVisible();
  });

  test("Profile, Support and Language pills open their pages", async ({ page }) => {
    await page.goto("/language");
    const settings = page.getByRole("navigation", { name: "Settings" });

    await settings.getByRole("link", { name: /profile/iu }).click();
    await expect(page.getByRole("heading", { level: 1, name: /profile/iu })).toBeVisible();

    await settings.getByRole("link", { name: /support/iu }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /feedback & support/iu }),
    ).toBeVisible();

    await settings.getByRole("link", { name: /language/iu }).click();
    await expect(page.getByRole("heading", { level: 1, name: /language/iu })).toBeVisible();
  });

  test("logout button logs user out and forgets their mode on the device", async ({
    logoutPage,
  }) => {
    await logoutPage.goto("/subscription");

    await expect(logoutPage.getByRole("button", { name: /logout/iu })).toBeVisible();
    await expect.poll(() => readDeviceMode(logoutPage.context())).toBe("focus");

    await logoutPage.getByRole("button", { name: /logout/iu }).click();
    await logoutPage.waitForURL(/\/$/u);

    await expect(logoutPage.getByRole("link", { name: "Log in" })).toBeVisible();
    expect(await readDeviceMode(logoutPage.context())).toBeUndefined();
  });
});
