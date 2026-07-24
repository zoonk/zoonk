import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Opens one progress page at the shared phone size and verifies the document
 * does not force horizontal scrolling.
 */
async function expectPageToFitMobileViewport({ page, path }: { page: Page; path: string }) {
  await page.goto(path);
  await expect(page.getByRole("figure", { name: /weekly score trend/iu })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );

  expect(hasHorizontalOverflow).toBe(false);
}

test.describe("Score", () => {
  test("unauthenticated visitors see a login prompt", async ({ page }) => {
    await page.goto("/score");

    await expect(page.getByText(/log in to track your progress/iu)).toBeVisible();
    await expect(page.getByRole("link", { name: /login/iu })).toHaveAttribute("href", "/login");
  });

  test("new learners see a start-learning prompt", async ({ userWithoutProgress }) => {
    await userWithoutProgress.goto("/score");

    await expect(
      userWithoutProgress.getByText(/start learning to track your progress/iu),
    ).toBeVisible();
  });

  test("shows one weighted 90-day score with its denominator and weekly trend", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/score");

    await expect(
      authenticatedPage.getByRole("heading", { exact: true, level: 1, name: "Score" }),
    ).toBeVisible();

    const scoreSummary = authenticatedPage.getByRole("region", { name: /score summary/iu });
    const scoreChart = authenticatedPage.getByRole("figure", { name: /weekly score trend/iu });

    await expect(scoreSummary).toContainText(/\d+(?:\.\d+)?%/u);
    await expect(scoreSummary).toContainText(/\d+ of \d+ answers correct/iu);
    await expect(scoreChart).toBeVisible();
    await expect(scoreChart).toContainText(/past 90 days/iu);
    await expect(scoreChart).toContainText(/\d+ answers/iu);

    await expect(
      authenticatedPage.getByRole("navigation", { name: /period selection/iu }),
    ).toHaveCount(0);

    await expect(
      authenticatedPage.getByRole("button", { name: /previous period|next period/iu }),
    ).toHaveCount(0);
  });

  test("keeps Score within a mobile viewport", async ({ browser, withProgressUser }) => {
    const browserContext = await browser.newContext({
      storageState: withProgressUser.storageState,
      viewport: { height: 812, width: 375 },
    });

    const scorePage = await browserContext.newPage();

    try {
      await expectPageToFitMobileViewport({ page: scorePage, path: "/score" });
    } finally {
      await browserContext.close();
    }
  });

  test("explains Score in one concise section", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/score");

    await expect(authenticatedPage.getByRole("heading", { name: /what is score/iu })).toBeVisible();

    await expect(
      authenticatedPage.getByText(/percentage of questions you answered correctly/iu),
    ).toBeVisible();

    await expect(
      authenticatedPage.getByRole("heading", { name: /how do i improve score/iu }),
    ).toHaveCount(0);

    await expect(
      authenticatedPage.getByRole("heading", { name: /why is score important/iu }),
    ).toHaveCount(0);
  });
});
