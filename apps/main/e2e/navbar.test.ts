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

test.describe("Catalog bar - Visitor", () => {
  test("is a section's bar, without a logo: the way home and a way in", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();

    const bar = page.getByRole("banner");

    // The logo is for marketing pages and login; the app's goal, tabs and account stay out.
    await expect(bar.getByRole("link", { name: "Zoonk home page" })).toHaveCount(0);
    await expect(bar.getByRole("button", { name: /current goal/iu })).toHaveCount(0);
    await expect(bar.getByRole("button", { name: /user menu/iu })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Learning tabs" })).toHaveCount(0);

    // The page names itself, so the bar only leads home (the home page for a visitor), and a
    // visitor's way in is in plain sight.
    await expect(bar.getByRole("link", { exact: true, name: "Home" })).toHaveAttribute("href", "/");
    await expect(bar.getByRole("link", { exact: true, name: "Back" })).toHaveCount(0);
    await expect(bar).not.toContainText("Courses");
    await expect(bar.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  });

  test("leads a learner home to Today", async ({ noProgressUser, userWithoutProgress: page }) => {
    const goal = await goalFixture({ userId: noProgressUser.id });
    await planFixture({ goalId: goal.id });
    await page.goto("/courses");

    const home = page.getByRole("banner").getByRole("link", { exact: true, name: "Home" });
    await expect(home).toHaveAttribute("href", "/today");
    await home.click();
    await expect(page).toHaveURL(/\/today$/u);
  });
});

test.describe("User menu - Account", () => {
  test("says whose account it is and holds search, statistics, the catalog, settings and logout; settings open on their hub and lead back", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await goalFixture({ userId: noProgressUser.id });
    await planFixture({ goalId: goal.id });
    await page.goto("/journey");

    const items = await openUserMenu(page);

    await expect(page.getByRole("menu")).toContainText(noProgressUser.email);

    await expect(items).toHaveText([
      /^Search/u,
      /^Statistics/u,
      "Explore courses",
      "Settings",
      "Help",
      "Logout",
    ]);

    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/u);
    // On a wide screen the hub's pages are in the sidebar, the profile beside them.
    await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();

    // Settings replace the app's bar: no tabs, no goal, no account.
    await expect(page.getByRole("navigation", { name: "Learning tabs" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /current goal/iu })).toHaveCount(0);

    // The hub lists the settings pages; each page keeps them beside it on a wide screen.
    const hub = page.getByRole("main");
    await hub.getByRole("link", { name: /profile/iu }).click();
    await expect(page.getByRole("heading", { level: 1, name: /profile/iu })).toBeVisible();

    const settings = page.getByRole("navigation", { name: "Settings" });
    await settings.getByRole("link", { exact: true, name: "Help" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();

    // A settings page goes back to the hub, which leaves the section for the page the learner
    // left for it.
    await page.getByRole("banner").getByRole("link", { name: "Back to Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/u);
    await page.getByRole("banner").getByRole("link", { exact: true, name: "Back" }).click();
    await expect(page).toHaveURL(/\/journey$/u);
  });

  test("in the learning tabs, Search opens the palette the top bar has no button for", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await goalFixture({ userId: noProgressUser.id });
    await planFixture({ goalId: goal.id });
    await page.goto("/today");

    const items = await openUserMenu(page);

    await expect(items).toHaveText([
      /^Search/u,
      /^Statistics/u,
      "Explore courses",
      "Settings",
      "Help",
      "Logout",
    ]);

    await page.getByRole("menuitem", { name: "Search" }).click();

    const palette = page.getByRole("dialog", { name: "Search" });
    await expect(palette.getByRole("combobox", { name: "Search" })).toBeFocused();
    await expect(palette.getByRole("group", { name: "Pages" })).toBeVisible();
  });

  test("the old My courses page opens Today, which starts a goal for a learner without one", async ({
    userWithoutProgress: page,
  }) => {
    await page.goto("/my");
    await expect(page).toHaveURL(/\/start$/u);
  });
});

test.describe("User menu - Guest", () => {
  test("a guest's menu offers an account instead of signing out", async ({ browser }) => {
    const { context, page } = await openAsGuest(browser);
    await page.goto("/buddy");

    // A guest has no name yet ("Anonymous" to auth), so the avatar shows no initial.
    await expect(page.getByRole("button", { name: /user menu/iu })).toHaveText("");

    const items = await openUserMenu(page);

    await expect(items).toHaveText([
      /^Search/u,
      /^Statistics/u,
      "Explore courses",
      "Settings",
      "Help",
      "Create an account",
    ]);

    await expect(page.getByRole("menuitem", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/login",
    );

    await context.close();
  });
});
