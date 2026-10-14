import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { type Page, expect, test } from "./fixtures";
import { openAsGuest } from "./guest-session";

/** Opens the user menu, again until the client has hydrated its trigger. */
async function openUserMenu(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: /user menu/iu }).click();
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 1000 });
  }).toPass();

  return page.getByRole("menu").getByRole("menuitem");
}

test.describe("Catalog chrome", () => {
  test("a visitor browses it in the app's frame, as a learner does, with a way in", async ({
    page,
  }) => {
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();

    const sidebar = page.getByRole("complementary", { name: "Sidebar" });

    await expect(sidebar.getByRole("navigation", { name: "Learning tabs" })).toBeVisible();

    await expect(sidebar.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fcourses",
    );
  });

  test("a learner browses it inside the app, with the learning tabs", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await goalFixture({ userId: noProgressUser.id });
    await planFixture({ goalId: goal.id });
    await page.goto("/courses");

    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();

    await expect(
      page
        .getByRole("complementary", { name: "Sidebar" })
        .getByRole("link", { name: "Explore courses" }),
    ).toHaveCount(0);

    const tabs = page.getByRole("navigation", { name: "Learning tabs" }).first();
    await tabs.getByRole("link", { name: /Today/u }).click();
    await expect(page).toHaveURL(/\/today$/u);
  });
});

test.describe("User menu - Account", () => {
  test("keeps account actions in the menu; settings keep the app's sidebar and lead back", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await goalFixture({ userId: noProgressUser.id });
    await planFixture({ goalId: goal.id });
    await page.goto("/plan");

    const items = await openUserMenu(page);

    await expect(page.getByRole("menu")).toContainText(noProgressUser.email);

    await expect(items).toHaveText(["Settings", /^Subscription/u, "Help", "Log out"]);

    await expect(page.getByRole("menuitem", { name: /^Subscription/u })).toHaveAttribute(
      "href",
      "/subscription",
    );

    await expectAccessibleScreen(page, "Account menu");

    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/u);
    // On a wide screen the hub shows its first page, the profile.
    await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();

    // On a wide screen settings keep the app's sidebar: its tabs, the goal and the account.
    await expect(page.getByRole("navigation", { name: "Learning tabs" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /current goal/iu })).toBeVisible();

    // The settings pages are tabs above each page.
    const settings = page.getByRole("navigation", { name: "Settings" });

    await expect(settings.getByRole("link", { name: /profile/iu })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await settings.getByRole("link", { exact: true, name: "Help" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();

    // On a phone a settings page goes back to the hub, which leaves the section for the page the
    // learner left for it.
    await page.setViewportSize({ height: 812, width: 375 });
    await page.getByRole("main").getByRole("link", { name: "Back to Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/u);
    await page.getByRole("main").getByRole("link", { exact: true, name: "Back" }).click();
    await expect(page).toHaveURL(/\/plan$/u);

    // A restored Plan entry remains the way back on the next visit to the same section.
    const phoneItems = await openUserMenu(page);
    await expect(phoneItems).toHaveText(["Settings", "Subscription", "Help", "Log out"]);
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/u);
    await page.getByRole("main").getByRole("link", { exact: true, name: "Help" }).click();
    await expect(page).toHaveURL(/\/support$/u);
    await expect(page.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Back to Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/u);
    await page.getByRole("main").getByRole("link", { exact: true, name: "Back" }).click();
    await expect(page).toHaveURL(/\/plan$/u);

    await openUserMenu(page);
    await page.getByRole("menuitem", { exact: true, name: "Subscription" }).click();
    await expect(page).toHaveURL(/\/subscription$/u);

    await expect(
      page.getByRole("heading", { level: 1, name: "Subscribe to Zoonk Plus" }),
    ).toBeVisible();
  });

  test("in the sidebar the whole account row opens the menu: its name, Enter and Space", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await goalFixture({ userId: noProgressUser.id });
    await planFixture({ goalId: goal.id });
    await page.goto("/plan");

    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    const account = sidebar.getByRole("button", { name: /^E2E User \w+, (?:.+, )?User menu$/u });
    const menu = page.getByRole("menu");

    // One target: the row is 44px tall and named by what it shows, the name first.
    const box = await account.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);

    // Clicking the name opens the menu, again until the client has hydrated the row.
    await expect(async () => {
      await sidebar.getByText(/^E2E User \w+$/u).click();
      await expect(menu).toBeVisible({ timeout: 1000 });
    }).toPass();

    await expect(menu).toContainText(noProgressUser.email);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(account).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    await page.keyboard.press("Space");
    await expect(menu).toBeVisible();
  });

  test("a subscriber opens their plan directly from the account menu on a laptop and phone", async ({
    subscriberPage: page,
  }) => {
    await page.goto("/courses");

    const items = await openUserMenu(page);

    await expect(items).toHaveText(["Settings", /^Subscription/u, "Help", "Log out"]);
    await page.getByRole("menuitem", { name: /^Subscription/u }).click();
    await expect(page).toHaveURL(/\/subscription$/u);
    await expect(page.getByRole("heading", { level: 1, name: "Plus" })).toBeVisible();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/courses");
    await openUserMenu(page);
    await page.getByRole("menuitem", { name: "Search or ask…" }).click();
    await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();
    await page.keyboard.press("Escape");

    await openUserMenu(page);
    await page.getByRole("menuitem", { name: /^Subscription/u }).click();

    await expect(page).toHaveURL(/\/subscription$/u);
    await expect(page.getByRole("heading", { level: 1, name: "Plus" })).toBeVisible();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();

    await page.goto("/pricing");
    await openUserMenu(page);
    await page.getByRole("menuitem", { name: "Search or ask…" }).click();
    await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();
  });

  test("the old My courses page opens Today, which starts a goal for a learner without one", async ({
    userWithoutProgress: page,
  }) => {
    await page.goto("/my");
    await expect(page).toHaveURL(/\/today$/u);
    await expect(page.getByRole("textbox", { name: "I want to" })).toBeVisible();
  });
});

test.describe("User menu - Guest", () => {
  test("a guest's menu offers an account instead of signing out", async ({ browser }) => {
    const { context, page } = await openAsGuest(browser);
    await page.goto("/buddy");

    // A guest has no name yet ("Anonymous" to auth), so the avatar shows no initial, and the
    // sidebar's account row says whose the menu is instead.
    const account = page
      .getByRole("complementary", { name: "Sidebar" })
      .getByRole("button", { name: /^Guest, (?:.+, )?User menu$/u });

    await expect(account).toHaveText(/^Guest\d*$/u);

    const items = await openUserMenu(page);

    // A guest who already has an account finds the way in too, and what an account costs.
    await expect(items).toHaveText(["Settings", "Pricing", "Help", "Create an account", "Log in"]);

    await expect(page.getByRole("menuitem", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/login",
    );

    await context.close();
  });
});
