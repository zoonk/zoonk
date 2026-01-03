import { expect, test } from "@zoonk/e2e/fixtures";

test.describe("Navbar - Unauthenticated", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows home icon link", async ({ page }) => {
    await expect(page.getByRole("link", { name: /home/i })).toBeVisible();
  });

  test("shows Courses link", async ({ page }) => {
    await expect(
      page.getByRole("link", { exact: true, name: "Courses" }),
    ).toBeVisible();
  });

  test("shows Search button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /search/i })).toBeVisible();
  });

  test("shows Learn link", async ({ page }) => {
    await expect(
      page.getByRole("link", { exact: true, name: "Learn" }),
    ).toBeVisible();
  });

  test("shows user menu button (avatar for login/settings access)", async ({
    page,
  }) => {
    // User menu is always visible - unauthenticated users see a generic avatar
    // that provides access to login and settings
    await expect(
      page.getByRole("button", { name: /user menu/i }),
    ).toBeVisible();
  });

  test("home icon navigates to home and shows home content", async ({
    page,
  }) => {
    await page.goto("/courses"); // Start from different page
    await page.getByRole("link", { name: /home/i }).click();

    await expect(
      page.getByRole("heading", { name: /learn anything with ai/i }),
    ).toBeVisible();
  });

  test("Courses link navigates to courses and shows courses content", async ({
    page,
  }) => {
    await page.getByRole("link", { exact: true, name: "Courses" }).click();

    await expect(
      page.getByRole("heading", { name: /explore courses/i }),
    ).toBeVisible();
  });

  test("Learn link navigates to learn and shows learn form", async ({
    page,
  }) => {
    await page.getByRole("link", { exact: true, name: "Learn" }).click();

    await expect(
      page.getByRole("heading", { name: /what do you want to learn/i }),
    ).toBeVisible();
  });
});

test.describe("Navbar - Authenticated", () => {
  test("shows user menu button", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");

    await expect(
      authenticatedPage.getByRole("button", { name: /user menu/i }),
    ).toBeVisible();
  });

  test("opens dropdown menu when clicking user menu", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.getByRole("button", { name: /user menu/i }).click();

    // Dropdown menu should be visible with menu items
    await expect(
      authenticatedPage.getByRole("menuitem", { name: /my courses/i }),
    ).toBeVisible();
  });

  test("dropdown shows expected menu items", async ({ authenticatedPage }) => {
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

  test("clicking My courses shows user's enrolled courses", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.getByRole("button", { name: /user menu/i }).click();
    await authenticatedPage
      .getByRole("menuitem", { name: /my courses/i })
      .click();

    await expect(
      authenticatedPage.getByRole("heading", { name: /my courses/i }),
    ).toBeVisible();
  });

  test("clicking Subscription shows subscription content", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.getByRole("button", { name: /user menu/i }).click();
    await authenticatedPage
      .getByRole("menuitem", { name: /subscription/i })
      .click();

    await expect(
      authenticatedPage.getByRole("heading", {
        level: 1,
        name: /subscription/i,
      }),
    ).toBeVisible();
  });

  test("clicking Settings shows settings content", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.getByRole("button", { name: /user menu/i }).click();
    await authenticatedPage
      .getByRole("menuitem", { name: /settings/i })
      .click();

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /settings/i }),
    ).toBeVisible();
  });

  test("clicking Support shows support content", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");
    await authenticatedPage.getByRole("button", { name: /user menu/i }).click();
    await authenticatedPage.getByRole("menuitem", { name: /support/i }).click();

    await expect(
      authenticatedPage.getByRole("heading", {
        level: 1,
        name: /help.*support/i,
      }),
    ).toBeVisible();
  });

  // Logout test uses dedicated logoutPage fixture to avoid session interference
  test("clicking Logout logs user out and redirects to home", async ({
    logoutPage,
  }) => {
    await logoutPage.goto("/");

    // Verify authenticated state - menu should show "Logout" option
    await logoutPage.getByRole("button", { name: /user menu/i }).click();
    await expect(
      logoutPage.getByRole("menuitem", { name: /logout/i }),
    ).toBeVisible();

    // Logout - this triggers a hard navigation
    await Promise.all([
      logoutPage.waitForURL(/^[^?]*\/$/),
      logoutPage.getByRole("menuitem", { name: /logout/i }).click(),
    ]);

    // Wait for page to fully load and session to be fetched
    await logoutPage.waitForLoadState("load");
    await logoutPage.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/get-session") &&
        response.status() === 200,
      { timeout: 10_000 },
    );

    // Verify user is logged out - menu should show "Login" instead of "Logout"
    await logoutPage.getByRole("button", { name: /user menu/i }).click();
    await expect(
      logoutPage.getByRole("menuitem", { name: /login/i }),
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
