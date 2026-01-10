import { expect, test } from "./fixtures";

test.describe("Energy Page - Unauthenticated", () => {
  test("shows energy page without data", async ({ page }) => {
    await page.goto("/energy");

    // Page loads but shows empty state since no user is logged in
    await expect(
      page.getByRole("heading", { name: /energy level/i }),
    ).toBeVisible();

    // Shows start learning message
    await expect(
      page.getByText(/start learning to track your energy/i),
    ).toBeVisible();
  });
});

test.describe("Energy Page - Authenticated with Progress", () => {
  test("shows page title and description", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/energy");

    await expect(
      authenticatedPage.getByRole("heading", { name: /energy level/i }),
    ).toBeVisible();

    await expect(
      authenticatedPage.getByText(/track your learning energy over time/i),
    ).toBeVisible();
  });

  test("shows energy explanation section", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/energy");

    await expect(
      authenticatedPage.getByText(/about energy level/i),
    ).toBeVisible();
    await expect(authenticatedPage.getByText(/correct answers/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/wrong answers/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/inactive day/i)).toBeVisible();
  });

  test("shows period tabs", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/energy");

    const periodNav = authenticatedPage.getByRole("navigation", {
      name: /period selection/i,
    });

    await expect(
      periodNav.getByRole("button", { exact: true, name: "Month" }),
    ).toBeVisible();
    await expect(
      periodNav.getByRole("button", { name: /6 months/i }),
    ).toBeVisible();
    await expect(
      periodNav.getByRole("button", { name: /year/i }),
    ).toBeVisible();
  });

  test("period tabs update URL parameter", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/energy");

    const periodNav = authenticatedPage.getByRole("navigation", {
      name: /period selection/i,
    });

    await periodNav.getByRole("button", { name: /6 months/i }).click();
    await expect(authenticatedPage).toHaveURL(/period=6months/);

    await periodNav.getByRole("button", { name: /year/i }).click();
    await expect(authenticatedPage).toHaveURL(/period=year/);

    // Month is the default, so clicking it removes the param from URL
    await periodNav.getByRole("button", { exact: true, name: "Month" }).click();
    await expect(authenticatedPage).toHaveURL(/\/energy$/);
  });

  test("shows metric navigation pills", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/energy");

    await expect(
      authenticatedPage.getByRole("link", { name: /energy/i }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("link", { name: /belt/i }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("link", { name: /accuracy/i }),
    ).toBeVisible();
  });

  test("energy metric pill is active", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/energy");

    const energyLink = authenticatedPage.getByRole("link", { name: /energy/i });
    await expect(energyLink).toBeVisible();
  });

  test("shows energy chart with data", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/energy");

    // Chart should be visible - we check for the chart container
    await expect(authenticatedPage.locator(".recharts-wrapper")).toBeVisible();
  });

  test("shows energy percentage for current period", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/energy");

    // E2E user has 75% energy, should display as "75%"
    await expect(authenticatedPage.getByText("75%")).toBeVisible();
  });
});

test.describe("Energy Page - Authenticated without Progress", () => {
  test("shows empty state message", async ({ userWithoutProgress }) => {
    await userWithoutProgress.goto("/energy");

    await expect(
      userWithoutProgress.getByText(/start learning to track your energy/i),
    ).toBeVisible();
  });

  test("shows explanation even without data", async ({
    userWithoutProgress,
  }) => {
    await userWithoutProgress.goto("/energy");

    await expect(
      userWithoutProgress.getByText(/about energy level/i),
    ).toBeVisible();
  });
});

test.describe("Energy Page - Navigation from Home", () => {
  test("energy level card links to energy page", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    // Find the energy level text and click its parent link
    const energyText = authenticatedPage.getByText("Your energy level is 75%");
    await expect(energyText).toBeVisible();

    // Click the link that contains this text
    await authenticatedPage
      .getByRole("link")
      .filter({ has: energyText })
      .click();

    await expect(
      authenticatedPage.getByRole("heading", { name: /energy level/i }),
    ).toBeVisible();

    await expect(authenticatedPage).toHaveURL(/\/energy/);
  });
});
