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
});

test.describe("Home Page - Authenticated", () => {
  test("user with progress sees continue learning instead of hero", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    await expect(
      authenticatedPage.getByText(/continue learning/i),
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
