import { expect, test } from "./fixtures";

const ACTIVE_DAY_LABEL = /^1 lesson completion on /iu;
const EMPTY_DAY_LABEL = /^0 lesson completions on /iu;

test.describe("Activity Page", () => {
  test("unauthenticated users see a login prompt", async ({ page }) => {
    await page.goto("/activity");

    await expect(page.getByRole("heading", { level: 1, name: /^activity$/iu })).toBeVisible();
    await expect(page.getByText(/log in to track your progress/iu)).toBeVisible();
    await expect(page.getByRole("link", { name: /login/iu })).toHaveAttribute("href", "/login");
  });

  test("learners can open Activity from the home lesson total and see their calendar", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    const progressSection = authenticatedPage.getByRole("region", { name: /^progress$/iu });

    const completedLessonsCard = progressSection.getByRole("article", {
      name: /lessons completed/iu,
    });

    await expect(completedLessonsCard).toContainText("1 lesson");
    await progressSection.getByRole("link", { name: /lessons completed/iu }).click();

    await expect(authenticatedPage).toHaveURL(/\/activity$/u);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /^activity$/iu }),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("article", { name: /learning days/iu })).toContainText(
      "1 day",
    );

    await expect(authenticatedPage.getByRole("article", { name: /learning time/iu })).toContainText(
      "2 min",
    );

    const activityChart = authenticatedPage.getByRole("figure", { name: /learning activity/iu });
    const activeDay = activityChart.getByRole("button", { name: ACTIVE_DAY_LABEL });

    await expect(activityChart).toBeVisible();

    await expect(
      activityChart.getByRole("group", { name: /lesson activity intensity from less to more/iu }),
    ).toBeVisible();

    await expect(activityChart.getByText(/^Mon$/u)).toHaveCount(0);
    await expect(activityChart.getByText(/^Wed$/u)).toHaveCount(0);
    await expect(activityChart.getByText(/^Fri$/u)).toHaveCount(0);
    await expect(activeDay).toBeVisible();
    await activeDay.hover();
    await expect(authenticatedPage.getByText(ACTIVE_DAY_LABEL)).toBeVisible();
  });

  test("learners can tap a day to keep its details visible", async ({
    browser,
    withProgressUser,
  }) => {
    const browserContext = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      storageState: withProgressUser.storageState,
      viewport: { height: 812, width: 375 },
    });

    const page = await browserContext.newPage();
    await page.goto("/activity");

    const activeDay = page.getByRole("button", { name: ACTIVE_DAY_LABEL });

    await activeDay.tap();
    await expect(page.getByText(ACTIVE_DAY_LABEL)).toBeVisible();

    await browserContext.close();
  });

  test("learners can inspect empty days with the keyboard", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/activity");

    const activeDay = authenticatedPage.getByRole("button", { name: ACTIVE_DAY_LABEL });

    await activeDay.focus();
    await activeDay.press("ArrowLeft");
    await expect(authenticatedPage.getByText(EMPTY_DAY_LABEL)).toBeVisible();
  });

  test("learners without progress see a prompt to start learning", async ({
    userWithoutProgress,
  }) => {
    await userWithoutProgress.goto("/activity");

    await expect(
      userWithoutProgress.getByText(/start learning to track your progress/iu),
    ).toBeVisible();
  });
});
