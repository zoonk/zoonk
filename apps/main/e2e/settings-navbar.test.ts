import { expect, test } from "./fixtures";
import { openAsGuest } from "./guest-session";

test.describe("Settings Navbar", () => {
  test("on a wide screen settings keep the app's sidebar and list their pages as tabs, opening on the first one a visitor has", async ({
    page,
  }) => {
    await page.goto("/settings");

    // The app's sidebar stays, so the learner never loses their place: a visitor's logo sits where
    // a learner's goal would, and no public header comes with it.
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });

    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("link", { exact: true, name: "Zoonk" })).toBeVisible();
    await expect(page.getByRole("link", { exact: true, name: "Zoonk" })).toHaveCount(1);

    // A visitor's first settings page is Preferences, marked in the tabs.
    await expect(page.getByRole("heading", { level: 1, name: "Preferences" })).toBeAttached();

    const settings = page.getByRole("main").getByRole("navigation", { name: "Settings" });

    await expect(settings.getByRole("link", { name: /preferences/iu })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await expect(settings.getByRole("link", { name: /subscription/iu })).toBeVisible();
    await expect(settings.getByRole("link", { exact: true, name: "Help" })).toBeVisible();

    // The profile is an account's; the language lives in Preferences. Memory is listed, its page
    // asking a visitor to log in.
    await expect(settings.getByRole("link", { name: /profile/iu })).toHaveCount(0);
    await expect(settings.getByRole("link", { name: /language/iu })).toHaveCount(0);
    await expect(settings.getByRole("link", { exact: true, name: "Memory" })).toBeVisible();
  });

  test("on a phone settings are a section: their own bar with the way back and the account's way in, opening on a hub of their pages, with the app's tabs", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 812, width: 375 });
    await page.goto("/settings");

    const bar = page.getByRole("main");

    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Learning tabs" })).toBeVisible();
    await expect(bar.getByRole("button", { name: /user menu/iu })).toHaveCount(0);

    // A visitor's way back is Today, and their way in sits on the right.
    await expect(bar.getByRole("link", { exact: true, name: "Back" })).toHaveAttribute(
      "href",
      "/today",
    );

    await expect(bar.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsettings",
    );
  });

  test("on desktop every settings page keeps the section's title and its pages as tabs under it, the current one marked, beside the app's sidebar", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 860, width: 1280 });
    const titleTops: number[] = [];

    for (const [path, title] of [
      ["/support", "Help"],
      ["/settings/appearance", "Preferences"],
      ["/settings/memory", "Memory"],
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop -- One page after the other, in one tab.
      await page.goto(path);

      const tabs = page.getByRole("navigation", { name: "Settings" });
      const sectionTitle = page.locator('[data-slot="section-title"]');

      // The page's own heading names it for screen readers; its tab marks it for the eyes.
      // oxlint-disable-next-line no-await-in-loop -- Waits for this page before measuring it.
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeAttached();

      // oxlint-disable-next-line no-await-in-loop -- Checks this page before the next one.
      await expect(tabs.getByRole("link", { exact: true, name: title })).toHaveAttribute(
        "aria-current",
        "page",
      );

      // oxlint-disable-next-line no-await-in-loop -- Measures this page before the next one.
      const [tabsBox, titleBox, sidebarBox] = await Promise.all([
        tabs.boundingBox(),
        sectionTitle.boundingBox(),
        page.getByRole("complementary", { name: "Sidebar" }).boundingBox(),
      ]);

      // "Settings" sits over the tabs, beside the app's sidebar, at the same place on every page.
      expect(titleBox!.y + titleBox!.height).toBeLessThan(tabsBox!.y);
      expect(sidebarBox!.x + sidebarBox!.width).toBeLessThan(titleBox!.x);
      titleTops.push(titleBox!.y);
    }

    expect(new Set(titleTops).size).toBe(1);

    await page.setViewportSize({ height: 1180, width: 820 });
    await expect(page.getByRole("navigation", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("link", { exact: true, name: "Preferences" })).toBeVisible();
  });

  test("on a phone a settings page leaves the sidebar out and goes back to the hub, which lists the pages", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 812, width: 375 });
    await page.goto("/support");

    await expect(page.getByRole("navigation", { name: "Settings" })).toHaveCount(0);
    await page.getByRole("main").getByRole("link", { name: "Back to Settings" }).click();

    await expect(page).toHaveURL(/\/settings$/u);

    await expect(
      page
        .getByRole("navigation", { name: "Settings" })
        .getByRole("link", { exact: true, name: "Help" }),
    ).toBeInViewport();
  });

  test("Subscription offers a visitor Plus in the app, with a way in or a free start", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: /subscription/iu }).click();

    await expect(page).toHaveURL(/\/subscription$/u);

    await expect(page.getByRole("link", { name: "Get Plus" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsubscription",
    );

    await expect(page.getByRole("main").getByRole("link", { name: "Start free" })).toBeVisible();
  });

  test("Help and Preferences open their pages from the tabs", async ({ page }) => {
    await page.setViewportSize({ height: 860, width: 1280 });
    await page.goto("/support");
    const settings = page.getByRole("navigation", { name: "Settings" });

    await settings.getByRole("link", { name: /preferences/iu }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Preferences" })).toBeAttached();

    await settings.getByRole("link", { exact: true, name: "Help" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Help" })).toBeAttached();
  });

  test("the old language page opens Preferences, where the language is", async ({ page }) => {
    await page.goto("/language");

    await expect(page).toHaveURL(/\/settings\/appearance$/u);
    await expect(page.getByRole("combobox", { name: "App language" })).toHaveValue("en");
  });

  test("the settings list logs the learner out, last", async ({ logoutPage }) => {
    await logoutPage.setViewportSize({ height: 812, width: 375 });
    await logoutPage.goto("/settings");

    await logoutPage
      .getByRole("navigation", { name: "Settings" })
      .getByRole("button", { name: "Log out" })
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

    await expect(settings.getByRole("link", { name: /preferences/iu })).toBeVisible();
    await expect(settings.getByRole("link", { name: /memory/iu })).toBeVisible();
    await expect(settings.getByRole("link", { name: /profile/iu })).toHaveCount(0);

    await page.goto("/profile");

    await expect(
      page.getByRole("heading", { name: "Create an account to use this page" }),
    ).toBeVisible();

    // The page and the bar both offer the account that keeps the plan.
    await expect(
      page.getByRole("main").getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/login?next=%2Fprofile");

    // On a phone, where the section's bar is at the top.
    await page.setViewportSize({ height: 812, width: 375 });

    await expect(
      page.getByRole("main").getByRole("link", { name: "Create an account" }),
    ).toHaveCount(2);

    await expect(page.getByRole("textbox", { name: "Name" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete account" })).toHaveCount(0);

    await context.close();
  });
});
