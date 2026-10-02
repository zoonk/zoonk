import { type Page, expect, test } from "./fixtures";

/** Picks an item from the user menu, opening it again until the client has hydrated its trigger. */
async function openUserMenuItem(page: Page, name: RegExp) {
  const item = page.getByRole("menuitem", { name });

  await expect(async () => {
    await page.getByRole("button", { name: /user menu/iu }).click();
    await expect(item).toBeVisible({ timeout: 1000 });
  }).toPass();

  await item.click();
}

test.describe("Navbar - Unauthenticated", () => {
  test("Courses link is active on the courses page, and Home opens the home page", async ({
    page,
  }) => {
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();

    const navigation = page.getByRole("navigation");

    await expect(navigation.getByRole("link", { exact: true, name: "Courses" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await navigation.getByRole("link", { name: /home/iu }).click();

    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("heading", { level: 1, name: /get ready for/iu })).toBeVisible();
  });
});

test.describe("Navbar - Authenticated", () => {
  test("the user menu opens My courses and settings, whose navigation opens Profile and Support", async ({
    userWithoutProgress: page,
  }) => {
    await page.goto("/courses");

    await openUserMenuItem(page, /my courses/iu);
    await expect(page.getByRole("heading", { name: /my courses/iu })).toBeVisible();

    await openUserMenuItem(page, /subscription/iu);
    await expect(page).toHaveURL(/\/subscription$/u);

    const settings = page.getByRole("navigation", { name: "Settings" });

    await settings.getByRole("link", { name: /profile/iu }).click();
    await expect(page.getByRole("heading", { level: 1, name: /profile/iu })).toBeVisible();

    await settings.getByRole("link", { name: /support/iu }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /feedback & support/iu }),
    ).toBeVisible();

    await settings.getByRole("link", { exact: true, name: "Home page" }).click();
    await expect(page).toHaveURL(/\/today$/u);
    await expect(page.getByRole("link", { exact: true, name: "Today" })).toBeVisible();
  });
});
