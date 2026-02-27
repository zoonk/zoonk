import { expect, test } from "./fixtures";

test.describe("Navbar - Unauthenticated", () => {
  test("Home link navigates to home page", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: /explore courses/i })).toBeVisible();

    // Scope to navigation to avoid conflicts with links in main content
    await page.getByRole("navigation").getByRole("link", { name: /home/i }).click();

    await expect(page.getByRole("heading", { name: /learn anything with ai/i })).toBeVisible();
  });

  test("Courses link navigates to courses page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /learn anything with ai/i })).toBeVisible();

    // Scope to navigation to avoid conflicts with "Explore courses" in hero
    await page.getByRole("navigation").getByRole("link", { exact: true, name: "Courses" }).click();

    await expect(page.getByRole("heading", { name: /explore courses/i })).toBeVisible();
  });

  test("Learn link navigates to learn page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /learn anything with ai/i })).toBeVisible();

    // Scope to navigation to avoid conflicts with "Learn anything" in hero
    await page.getByRole("navigation").getByRole("link", { exact: true, name: "Learn" }).click();

    await expect(page.getByRole("heading", { name: /what do you want to learn/i })).toBeVisible();
  });

  test("Home link is active on home page", async ({ page }) => {
    await page.goto("/");

    const homeLink = page.getByRole("navigation").getByRole("link", { name: /home/i });

    await expect(homeLink).toHaveAttribute("aria-current", "page");
  });

  test("Courses link is active on courses page", async ({ page }) => {
    await page.goto("/courses");

    const coursesLink = page
      .getByRole("navigation")
      .getByRole("link", { exact: true, name: "Courses" });

    await expect(coursesLink).toHaveAttribute("aria-current", "page");
  });

  test("Learn link is active on learn page", async ({ page }) => {
    await page.goto("/learn");

    const learnLink = page
      .getByRole("navigation")
      .getByRole("link", { exact: true, name: "Learn" });

    await expect(learnLink).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Navbar - Authenticated", () => {
  test("My courses menu item navigates to my courses page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("button", { name: /user menu/i }).click();

    await authenticatedPage.getByRole("menuitem", { name: /my courses/i }).click();

    await expect(authenticatedPage.getByRole("heading", { name: /my courses/i })).toBeVisible();
  });

  test("Subscription menu item navigates to subscription page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("button", { name: /user menu/i }).click();

    await authenticatedPage.getByRole("menuitem", { name: /subscription/i }).click();

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /subscription/i }),
    ).toBeVisible();
  });

  test("Profile menu item navigates to profile page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("button", { name: /user menu/i }).click();

    await authenticatedPage.getByRole("menuitem", { name: /profile/i }).click();

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /profile/i }),
    ).toBeVisible();
  });

  test("Support menu item navigates to support page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("button", { name: /user menu/i }).click();

    await authenticatedPage.getByRole("menuitem", { name: /support/i }).click();

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /help.*support/i }),
    ).toBeVisible();
  });
});
