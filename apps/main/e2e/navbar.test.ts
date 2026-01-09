import { expect, test } from "./fixtures";

test.describe("Navbar - Unauthenticated", () => {
  test("Home link navigates to home page", async ({ page }) => {
    await page.goto("/en/courses");

    await page.getByRole("link", { name: /home/i }).click();

    await expect(
      page.getByRole("heading", { name: /learn anything with ai/i }),
    ).toBeVisible();
  });

  test("Courses link navigates to courses page", async ({ page }) => {
    await page.goto("/en/");

    await page.getByRole("link", { exact: true, name: "Courses" }).click();

    await expect(
      page.getByRole("heading", { name: /explore courses/i }),
    ).toBeVisible();
  });

  test("Learn link navigates to learn page", async ({ page }) => {
    await page.goto("/en/");

    await page.getByRole("link", { exact: true, name: "Learn" }).click();

    await expect(
      page.getByRole("heading", { name: /what do you want to learn/i }),
    ).toBeVisible();
  });

  test("Home link is active on home page", async ({ page }) => {
    await page.goto("/en/");

    const homeLink = page.getByRole("link", { name: /home/i });

    await expect(homeLink).toHaveAttribute("aria-current", "page");
  });

  test("Courses link is active on courses page", async ({ page }) => {
    await page.goto("/en/courses");

    const coursesLink = page.getByRole("link", {
      exact: true,
      name: "Courses",
    });

    await expect(coursesLink).toHaveAttribute("aria-current", "page");
  });

  test("Learn link is active on learn page", async ({ page }) => {
    await page.goto("/en/learn");

    const learnLink = page.getByRole("link", { exact: true, name: "Learn" });

    await expect(learnLink).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Navbar - Authenticated", () => {
  test("My courses menu item navigates to my courses page", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/en/");

    await authenticatedPage.getByRole("button", { name: /user menu/i }).click();

    await authenticatedPage
      .getByRole("menuitem", { name: /my courses/i })
      .click();

    await expect(
      authenticatedPage.getByRole("heading", { name: /my courses/i }),
    ).toBeVisible();
  });

  test("Settings menu item navigates to settings page", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/en/");

    await authenticatedPage.getByRole("button", { name: /user menu/i }).click();

    await authenticatedPage
      .getByRole("menuitem", { name: /settings/i })
      .click();

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /settings/i }),
    ).toBeVisible();
  });
});
