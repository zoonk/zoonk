import { expect, test } from "./fixtures";
import { openAsGuest } from "./guest-session";

test.describe("Settings Navbar", () => {
  test("settings are a section: their own bar with the way back and the account's way in, opening on a hub of their pages, without the app's tabs or a logo", async ({
    page,
  }) => {
    await page.goto("/settings");

    const bar = page.getByRole("banner");

    // Nothing from the app bar: no tabs, no goal, no account menu, no logo.
    await expect(page.getByRole("navigation", { name: "Learning tabs" })).toHaveCount(0);
    await expect(bar.getByRole("button", { name: /user menu/iu })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Zoonk home page" })).toHaveCount(0);

    // On a wide screen the hub's pages sit in the sidebar and the first one a visitor has
    // (Appearance) beside it; a visitor's way back is the home page, and their way in sits on the
    // right.
    await expect(page.getByRole("heading", { level: 1, name: "Appearance" })).toBeVisible();
    await expect(bar.getByRole("link", { exact: true, name: "Back" })).toHaveAttribute("href", "/");
    await expect(bar.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");

    const settings = page.getByRole("main").getByRole("navigation", { name: "Settings" });

    await expect(settings.getByRole("link", { name: /subscription/iu })).toBeVisible();
    await expect(settings.getByRole("link", { name: /profile/iu })).toBeVisible();
    await expect(settings.getByRole("link", { name: /appearance/iu })).toBeVisible();
    await expect(settings.getByRole("link", { exact: true, name: "Help" })).toBeVisible();

    // The language lives in Appearance; memory needs a session, guardian links an account under 18.
    await expect(settings.getByRole("link", { name: /language/iu })).toHaveCount(0);
    await expect(settings.getByRole("link", { name: /memory/iu })).toHaveCount(0);
    await expect(settings.getByRole("link", { name: /guardian/iu })).toHaveCount(0);
  });

  test("on desktop every settings page keeps the pages in a sidebar beside it, the current one marked, and goes back to the hub", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 860, width: 1280 });

    for (const [path, title] of [
      ["/support", "Help"],
      ["/settings/appearance", "Appearance"],
      ["/profile", "Profile"],
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop -- One page after the other, in one tab.
      await page.goto(path);

      const sidebar = page.getByRole("navigation", { name: "Settings" });
      const heading = page.getByRole("heading", { level: 1, name: title });

      // oxlint-disable-next-line no-await-in-loop -- Waits for this page before measuring it.
      await expect(heading).toBeVisible();

      // oxlint-disable-next-line no-await-in-loop -- Checks this page before the next one.
      await expect(sidebar.getByRole("link", { exact: true, name: title })).toHaveAttribute(
        "aria-current",
        "page",
      );

      // oxlint-disable-next-line no-await-in-loop -- Measures this page before the next one.
      const [sidebarBox, titleBox] = await Promise.all([
        sidebar.boundingBox(),
        heading.boundingBox(),
      ]);

      // The sidebar sits beside the page, left of its title.
      expect(sidebarBox!.x + sidebarBox!.width).toBeLessThan(titleBox!.x);

      // oxlint-disable-next-line no-await-in-loop -- Checks this page before the next one.
      await expect(
        page.getByRole("banner").getByRole("link", { name: "Back to Settings" }),
      ).toHaveAttribute("href", "/settings");
    }
  });

  test("on a phone a settings page leaves the sidebar out and goes back to the hub, which lists the pages", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 812, width: 375 });
    await page.goto("/support");

    await expect(page.getByRole("navigation", { name: "Settings" })).toHaveCount(0);
    await page.getByRole("banner").getByRole("link", { name: "Back to Settings" }).click();

    await expect(page).toHaveURL(/\/settings$/u);

    await expect(
      page
        .getByRole("navigation", { name: "Settings" })
        .getByRole("link", { exact: true, name: "Help" }),
    ).toBeInViewport();
  });

  test("Subscription opens the public pricing page for a visitor", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: /subscription/iu }).click();

    await expect(page).toHaveURL(/\/pricing$/u);
    await expect(page.getByRole("link", { name: "Try free" })).toBeVisible();
  });

  test("Profile, Help and Appearance open their pages from the sidebar", async ({ page }) => {
    await page.setViewportSize({ height: 860, width: 1280 });
    await page.goto("/support");
    const settings = page.getByRole("navigation", { name: "Settings" });

    await settings.getByRole("link", { name: /profile/iu }).click();
    await expect(page.getByRole("heading", { level: 1, name: /profile/iu })).toBeVisible();

    await settings.getByRole("link", { exact: true, name: "Help" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();

    await settings.getByRole("link", { name: /appearance/iu }).click();
    await expect(page.getByRole("heading", { level: 1, name: /appearance/iu })).toBeVisible();
  });

  test("the old language page opens Appearance, where the language is", async ({ page }) => {
    await page.goto("/language");

    await expect(page).toHaveURL(/\/settings\/appearance$/u);
    await expect(page.getByRole("combobox", { name: "App language" })).toHaveValue("en");
  });

  test("the settings list logs the learner out, last", async ({ logoutPage }) => {
    await logoutPage.goto("/subscription");

    await logoutPage
      .getByRole("navigation", { name: "Settings" })
      .getByRole("button", { name: "Logout" })
      .click();

    await logoutPage.waitForURL(/\/$/u);

    await expect(logoutPage.getByRole("link", { name: "Log in" })).toBeVisible();
  });

  test("a guest keeps their settings but not the account's, and is offered an account", async ({
    browser,
  }) => {
    const { context, page } = await openAsGuest(browser);
    await page.goto("/settings");

    const settings = page.getByRole("main").getByRole("navigation", { name: "Settings" });

    await expect(settings.getByRole("link", { name: /appearance/iu })).toBeVisible();
    await expect(settings.getByRole("link", { name: /memory/iu })).toBeVisible();
    await expect(settings.getByRole("link", { name: /profile/iu })).toHaveCount(0);

    await page.goto("/profile");

    await expect(
      page.getByText("Create an account to keep your plan and use this page."),
    ).toBeVisible();

    // The page and the bar both offer the account that keeps the plan.
    await expect(
      page.getByRole("main").getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/login");

    await expect(
      page.getByRole("banner").getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/login");

    await expect(page.getByRole("textbox", { name: "Name" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete account" })).toHaveCount(0);

    await context.close();
  });
});
