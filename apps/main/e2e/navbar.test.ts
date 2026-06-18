import { expect, test } from "./fixtures";

test.describe("Navbar - Unauthenticated", () => {
  test("Home link shows the learn form on the home page", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();

    await page.getByRole("navigation").getByRole("link", { name: /home/iu }).click();

    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByRole("heading", { name: /learn anything/iu })).toBeVisible();
  });

  test("New course link navigates to learn page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /learn anything/iu })).toBeVisible();

    await page
      .getByRole("navigation")
      .getByRole("link", { exact: true, name: "New course" })
      .click();

    await expect(page.getByRole("heading", { name: /learn anything/iu })).toBeVisible();
  });

  test("Courses page stays directly available without a navbar link", async ({ page }) => {
    await page.goto("/courses");

    const coursesLink = page
      .getByRole("navigation")
      .getByRole("link", { exact: true, name: "Courses" });

    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();
    await expect(coursesLink).not.toBeVisible();
  });

  test("New course link is active on learn page", async ({ page }) => {
    await page.goto("/learn");

    const learnLink = page
      .getByRole("navigation")
      .getByRole("link", { exact: true, name: "New course" });

    await expect(learnLink).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Navbar - Authenticated", () => {
  test("Home link is active on home page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");

    const homeLink = authenticatedPage
      .getByRole("navigation")
      .getByRole("link", { name: /home/iu });

    await expect(homeLink).toHaveAttribute("aria-current", "page");
  });

  test("My courses menu item navigates to my courses page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("button", { name: /user menu/iu }).click();

    await authenticatedPage.getByRole("menuitem", { name: /my courses/iu }).click();

    await expect(authenticatedPage.getByRole("heading", { name: /my courses/iu })).toBeVisible();
  });

  test("Subscription menu item navigates to subscription page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("button", { name: /user menu/iu }).click();

    await authenticatedPage.getByRole("menuitem", { name: /subscription/iu }).click();

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /subscription/iu }),
    ).toBeVisible();
  });

  test("Profile menu item navigates to profile page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("button", { name: /user menu/iu }).click();

    await authenticatedPage.getByRole("menuitem", { name: /profile/iu }).click();

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /profile/iu }),
    ).toBeVisible();
  });

  test("Support menu item navigates to support page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("button", { name: /user menu/iu }).click();

    await authenticatedPage.getByRole("menuitem", { name: /support/iu }).click();

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /feedback & support/iu }),
    ).toBeVisible();
  });
});
