import { expect, test } from "./fixtures";
import { MODES, expectMode, showInMode } from "./learn-personas";

const ACTIVE_DAY_LABEL = /^1 lesson completion on /iu;
const EMPTY_DAY_LABEL = /^0 lesson completions on /iu;

test.describe("Activity Page", () => {
  test("unauthenticated users see a login prompt", async ({ page }) => {
    await page.goto("/activity");

    await expect(page.getByRole("heading", { level: 1, name: /^activity$/iu })).toBeVisible();
    await expect(page.getByText(/log in to track your progress/iu)).toBeVisible();
    await expect(page.getByRole("link", { name: /login/iu })).toHaveAttribute("href", "/login");
  });

  for (const mode of MODES) {
    test(`learners see their activity calendar in ${mode}`, async ({
      browser,
      withProgressUser,
    }) => {
      const context = await browser.newContext({ storageState: withProgressUser.storageState });
      await showInMode(context, { mode, userId: withProgressUser.id });
      const page = await context.newPage();

      try {
        await page.goto("/activity");
        await expectMode(page, mode);

        await expect(page.getByRole("heading", { level: 1, name: /^activity$/iu })).toBeVisible();

        await expect(page.getByRole("article", { name: /learning days/iu })).toContainText("1 day");

        await expect(page.getByRole("article", { name: /learning time/iu })).toContainText("2 min");

        const activityChart = page.getByRole("figure", { name: /learning activity/iu });
        const activeDay = activityChart.getByRole("button", { name: ACTIVE_DAY_LABEL });

        await expect(activityChart).toBeVisible();

        await expect(
          activityChart.getByRole("group", {
            name: /lesson activity intensity from less to more/iu,
          }),
        ).toBeVisible();

        await expect(activityChart.getByText(/^Mon$/u)).toHaveCount(0);
        await expect(activityChart.getByText(/^Wed$/u)).toHaveCount(0);
        await expect(activityChart.getByText(/^Fri$/u)).toHaveCount(0);
        await expect(activeDay).toBeVisible();
        await activeDay.hover();
        await expect(page.getByText(ACTIVE_DAY_LABEL)).toBeVisible();
      } finally {
        await context.close();
      }
    });
  }

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
