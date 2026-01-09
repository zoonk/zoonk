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

    await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();
    await expect(
      authenticatedPage.getByText("Your energy level is 75%"),
    ).toBeVisible();
  });

  test("authenticated user with progress sees belt level", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();
    await expect(
      authenticatedPage.getByText("Orange Belt - Level 8"),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText("500 BP to next level"),
    ).toBeVisible();
  });

  test("authenticated user with progress sees accuracy", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();
    await expect(
      authenticatedPage.getByText("85% correct answers"),
    ).toBeVisible();
    await expect(authenticatedPage.getByText("Past 3 months")).toBeVisible();
  });

  test("authenticated user with progress sees best day", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/best day/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/with 85%/i)).toBeVisible();
    await expect(authenticatedPage.getByText("Past 3 months")).toBeVisible();
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
