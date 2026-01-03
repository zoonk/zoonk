import { expect, test } from "./fixtures";

test.describe("Navbar - Unauthenticated", () => {
  test("shows all expected navbar items", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /home/i })).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Courses" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Learn" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /search/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /user menu/i }),
    ).toBeVisible();
  });

  test("navbar links navigate to correct pages", async ({ page }) => {
    await page.goto("/");

    // Navigate to Courses
    await page.getByRole("link", { exact: true, name: "Courses" }).click();
    await expect(
      page.getByRole("heading", { name: /explore courses/i }),
    ).toBeVisible();

    // Navigate to Learn
    await page.getByRole("link", { exact: true, name: "Learn" }).click();
    await expect(
      page.getByRole("heading", { name: /what do you want to learn/i }),
    ).toBeVisible();

    // Navigate back home
    await page.getByRole("link", { name: /home/i }).click();
    await expect(
      page.getByRole("heading", { name: /learn anything with ai/i }),
    ).toBeVisible();
  });
});

test.describe("Navbar - Authenticated", () => {
  test("dropdown menu shows all expected items", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.getByRole("button", { name: /user menu/i }).click();

    await expect(
      authenticatedPage.getByRole("menuitem", { name: /my courses/i }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("menuitem", { name: /subscription/i }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("menuitem", { name: /settings/i }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("menuitem", { name: /support/i }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("menuitem", { name: /logout/i }),
    ).toBeVisible();
  });

  test("menu items navigate to correct pages", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    // My courses
    await authenticatedPage.getByRole("button", { name: /user menu/i }).click();
    await authenticatedPage
      .getByRole("menuitem", { name: /my courses/i })
      .click();
    await expect(
      authenticatedPage.getByRole("heading", { name: /my courses/i }),
    ).toBeVisible();

    // Settings
    await authenticatedPage.getByRole("button", { name: /user menu/i }).click();
    await authenticatedPage
      .getByRole("menuitem", { name: /settings/i })
      .click();
    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /settings/i }),
    ).toBeVisible();
  });
});

test.describe("Deep Linking", () => {
  test("direct access to /courses loads courses page content", async ({
    page,
  }) => {
    await page.goto("/courses");

    await expect(
      page.getByRole("heading", { name: /explore courses/i }),
    ).toBeVisible();
    await expect(page.getByText("Machine Learning").first()).toBeVisible();
  });

  test("direct access to course detail loads course content", async ({
    page,
  }) => {
    await page.goto("/b/ai/c/machine-learning");

    await expect(
      page.getByRole("heading", { name: /machine learning/i }),
    ).toBeVisible();
  });
});
