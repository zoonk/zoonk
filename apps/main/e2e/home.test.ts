import { expect, test } from "@zoonk/e2e/fixtures";

const HEADING_LEARN_ANYTHING = /learn anything with ai/i;
const HEADING_LEARN_PAGE = /what do you want to learn/i;
const HEADING_COURSES_PAGE = /explore courses/i;
const TEXT_CONTINUE_LEARNING = /continue learning/i;

test.describe("Home Page - Unauthenticated", () => {
  test("shows hero section with headline and CTAs", async ({ page }) => {
    await page.goto("/");

    const hero = page.getByRole("main");

    await expect(
      hero.getByRole("heading", { name: HEADING_LEARN_ANYTHING }),
    ).toBeVisible();

    await expect(
      hero.getByRole("link", { exact: true, name: "Learn anything" }),
    ).toBeVisible();

    await expect(
      hero.getByRole("link", { exact: true, name: "Explore courses" }),
    ).toBeVisible();
  });

  test("navigates to learn page from CTA and shows learn content", async ({
    page,
  }) => {
    await page.goto("/");

    const hero = page.getByRole("main");
    await hero
      .getByRole("link", { exact: true, name: "Learn anything" })
      .click();

    // Verify user sees learn page content (not just URL)
    await expect(
      page.getByRole("heading", { name: HEADING_LEARN_PAGE }),
    ).toBeVisible();
  });

  test("navigates to courses page from CTA and shows courses content", async ({
    page,
  }) => {
    await page.goto("/");

    const hero = page.getByRole("main");
    await hero
      .getByRole("link", { exact: true, name: "Explore courses" })
      .click();

    // Verify user sees courses page content (not just URL)
    await expect(
      page.getByRole("heading", { name: HEADING_COURSES_PAGE }),
    ).toBeVisible();
  });

  test("loads Portuguese locale and shows Portuguese content", async ({
    page,
  }) => {
    await page.goto("/pt");

    // Verify Portuguese content is visible
    await expect(
      page.getByRole("heading", { name: /aprenda qualquer coisa com ia/i }),
    ).toBeVisible();
  });
});

test.describe("Home Page - Authenticated", () => {
  test("shows continue learning section for user with progress", async ({
    userWithProgress,
  }) => {
    await userWithProgress.goto("/");

    await expect(
      userWithProgress.getByText(TEXT_CONTINUE_LEARNING),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("does NOT show hero section when authenticated with progress", async ({
    userWithProgress,
  }) => {
    await userWithProgress.goto("/");

    // Wait for page to load
    await expect(
      userWithProgress.getByText(TEXT_CONTINUE_LEARNING),
    ).toBeVisible({ timeout: 10_000 });

    // Hero heading should NOT be visible for authenticated users
    await expect(
      userWithProgress.getByRole("heading", { name: HEADING_LEARN_ANYTHING }),
    ).not.toBeVisible();
  });

  test("shows hero for authenticated user without course enrollment", async ({
    userWithoutProgress,
  }) => {
    await userWithoutProgress.goto("/");

    // User without course enrollment should see the hero section
    await expect(
      userWithoutProgress.getByRole("heading", { name: HEADING_LEARN_ANYTHING }),
    ).toBeVisible();
  });
});

test.describe("Home Page - Mobile", () => {
  test.use({ viewport: { height: 667, width: 375 } });

  test("hero section displays correctly on mobile", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: HEADING_LEARN_ANYTHING }),
    ).toBeVisible();
  });

  test("CTAs are visible and tappable on mobile", async ({ page }) => {
    await page.goto("/");

    const learnCTA = page.getByRole("link", {
      exact: true,
      name: "Learn anything",
    });
    const coursesCTA = page.getByRole("link", {
      exact: true,
      name: "Explore courses",
    });

    await expect(learnCTA).toBeVisible();
    await expect(coursesCTA).toBeVisible();

    // Verify they can be clicked
    await learnCTA.click();
    await expect(
      page.getByRole("heading", { name: HEADING_LEARN_PAGE }),
    ).toBeVisible();
  });
});
