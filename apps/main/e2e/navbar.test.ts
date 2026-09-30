import { expect, test } from "./fixtures";

test.describe("Navbar - Unauthenticated", () => {
  test("Home link opens the home page", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();

    await page.getByRole("navigation").getByRole("link", { name: /home/iu }).click();

    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("heading", { level: 1, name: /get ready for/iu })).toBeVisible();
  });

  test("New course link navigates to start page", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();

    await page
      .getByRole("navigation")
      .getByRole("link", { exact: true, name: "New course" })
      .click();

    await expect(page).toHaveURL(/\/start$/u);
    await expect(page.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();
  });

  test("Courses link navigates to courses page", async ({ page }) => {
    await page.goto("/courses/science");

    await page.getByRole("navigation").getByRole("link", { exact: true, name: "Courses" }).click();

    await expect(page).toHaveURL(/\/courses$/u);
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();
  });

  test("Courses link is active on courses page", async ({ page }) => {
    await page.goto("/courses");

    const coursesLink = page
      .getByRole("navigation")
      .getByRole("link", { exact: true, name: "Courses" });

    await expect(coursesLink).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Navbar - Authenticated", () => {
  test("My courses menu item navigates to my courses page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/courses");
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("button", { name: /user menu/iu }).click();

    await authenticatedPage.getByRole("menuitem", { name: /my courses/iu }).click();

    await expect(authenticatedPage.getByRole("heading", { name: /my courses/iu })).toBeVisible();
  });

  test("Subscription menu item navigates to subscription page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/courses");
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("button", { name: /user menu/iu }).click();

    await authenticatedPage.getByRole("menuitem", { name: /subscription/iu }).click();

    await expect(authenticatedPage).toHaveURL(/\/subscription$/u);
  });

  test("Profile menu item navigates to profile page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/courses");
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("button", { name: /user menu/iu }).click();

    await authenticatedPage.getByRole("menuitem", { name: /profile/iu }).click();

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /profile/iu }),
    ).toBeVisible();
  });

  test("Support menu item navigates to support page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/courses");
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("button", { name: /user menu/iu }).click();

    await authenticatedPage.getByRole("menuitem", { name: /support/iu }).click();

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /feedback & support/iu }),
    ).toBeVisible();
  });
});
