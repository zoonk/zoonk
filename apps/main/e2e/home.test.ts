import { expect, test } from "./fixtures";

test.describe("Home Page - Unauthenticated", () => {
  test("shows hero with CTAs that navigate to correct pages", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByText(/continue learning/i)).not.toBeVisible();

    const hero = page.getByRole("main");

    await expect(
      hero.getByRole("heading", { name: /learn anything with ai/i }),
    ).toBeVisible();

    // Test Learn anything CTA
    await hero
      .getByRole("link", { exact: true, name: "Learn anything" })
      .click();

    await expect(
      page.getByRole("heading", { name: /what do you want to learn/i }),
    ).toBeVisible();
  });

  test("does not show performance section", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/^performance$/i)).not.toBeVisible();
  });
});

test.describe("Home Page - Authenticated", () => {
  test("user with progress sees continue learning instead of hero", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    // Use .first() to handle potential duplicates during streaming/hydration
    await expect(
      authenticatedPage
        .getByRole("heading", { name: /continue learning/i })
        .first(),
    ).toBeVisible();

    await expect(
      authenticatedPage.getByRole("heading", {
        name: /learn anything with ai/i,
      }),
    ).not.toBeVisible();
  });

  test("user without progress sees hero section", async ({
    userWithoutProgress,
  }) => {
    await userWithoutProgress.goto("/");

    await expect(
      userWithoutProgress.getByText(/continue learning/i),
    ).not.toBeVisible();

    await expect(
      userWithoutProgress.getByRole("heading", {
        name: /learn anything with ai/i,
      }),
    ).toBeVisible();
  });
});

test.describe("Home Page - Performance Section", () => {
  test("authenticated user with progress sees energy level", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    // Wait for Suspense content to load - Performance section only renders when data is available
    await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();

    // Use regex to match "Your energy is X%" where X can be any number
    await expect(
      authenticatedPage.getByText(/your energy is \d+%/i),
    ).toBeVisible();
  });

  test("authenticated user with progress sees belt level", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();

    // Use regex to match belt level pattern (e.g., "Orange Belt - Level 8")
    await expect(
      authenticatedPage.getByText(/belt - level \d+/i),
    ).toBeVisible();

    // Use regex to match BP to next level pattern
    await expect(
      authenticatedPage.getByText(/\d+ bp to next level/i),
    ).toBeVisible();
  });

  test("authenticated user with progress sees score", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();

    // Use regex to match any percentage of correct answers (e.g., "75%" or "75.2%")
    await expect(
      authenticatedPage.getByText(/\d+(\.\d+)?% correct answers/i),
    ).toBeVisible();
  });

  test("authenticated user with progress sees best day", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/best day/i)).toBeVisible();

    // Use regex to match any day of week with percentage (e.g., "Sunday with 76.1%")
    await expect(
      authenticatedPage.getByText(
        /(monday|tuesday|wednesday|thursday|friday|saturday|sunday) with \d+(\.\d+)?%/i,
      ),
    ).toBeVisible();
  });

  test("authenticated user with progress sees best time", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/best time/i)).toBeVisible();

    // Use regex to match time period with percentage (e.g., "Morning with 90%")
    await expect(
      authenticatedPage.getByText(
        /(morning|afternoon|evening|night) with \d+%/i,
      ),
    ).toBeVisible();
  });

  test("user without progress does not see performance section", async ({
    userWithoutProgress,
  }) => {
    await userWithoutProgress.goto("/");

    await expect(
      userWithoutProgress.getByText(/^performance$/i),
    ).not.toBeVisible();
  });
});
