import { expect, test } from "./fixtures";

const HEADING_LEARN_ANYTHING = /learn anything with ai/i;
const HEADING_LEARN_PAGE = /what do you want to learn/i;
const TEXT_CONTINUE_LEARNING = /continue learning/i;

test.describe("Home Page - Unauthenticated", () => {
  test("shows hero with CTAs that navigate to correct pages", async ({
    page,
  }) => {
    await page.goto("/");

    const hero = page.getByRole("main");
    await expect(
      hero.getByRole("heading", { name: HEADING_LEARN_ANYTHING }),
    ).toBeVisible();

    // Test Learn anything CTA
    await hero
      .getByRole("link", { exact: true, name: "Learn anything" })
      .click();
    await expect(
      page.getByRole("heading", { name: HEADING_LEARN_PAGE }),
    ).toBeVisible();
  });
});

test.describe("Home Page - Authenticated", () => {
  test("user with progress sees continue learning instead of hero", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    await expect(
      authenticatedPage.getByText(TEXT_CONTINUE_LEARNING),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      authenticatedPage.getByRole("heading", { name: HEADING_LEARN_ANYTHING }),
    ).not.toBeVisible();
  });

  test("user without progress sees hero section", async ({
    userWithoutProgress,
  }) => {
    await userWithoutProgress.goto("/");

    await expect(
      userWithoutProgress.getByRole("heading", {
        name: HEADING_LEARN_ANYTHING,
      }),
    ).toBeVisible();
  });
});

test.describe("Home Page - Mobile", () => {
  test.use({ viewport: { height: 667, width: 375 } });

  test("hero and CTAs work on mobile viewport", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: HEADING_LEARN_ANYTHING }),
    ).toBeVisible();

    const learnCTA = page.getByRole("link", {
      exact: true,
      name: "Learn anything",
    });
    await expect(learnCTA).toBeVisible();

    await learnCTA.click();
    await expect(
      page.getByRole("heading", { name: HEADING_LEARN_PAGE }),
    ).toBeVisible();
  });
});
