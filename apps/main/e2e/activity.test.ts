import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";
import { expectMode, showInMode } from "./learn-personas";

const ACTIVE_DAY_LABEL = /^1 lesson completion on /iu;
const EMPTY_DAY_LABEL = /^0 lesson completions on /iu;

test.describe("Activity Page", () => {
  test("learners see their activity calendar and inspect its days by pointer and keyboard", async ({
    browser,
    withProgressUser,
  }) => {
    const context = await browser.newContext({ storageState: withProgressUser.storageState });
    await showInMode(context, { mode: "fun", userId: withProgressUser.id });
    const page = await context.newPage();

    try {
      await page.goto("/activity");
      await expectMode(page, "fun");

      await expect(page.getByRole("heading", { level: 1, name: /^activity$/iu })).toBeVisible();

      await expect(page.getByRole("article", { name: /learning days/iu })).toContainText("1 day");

      await expect(page.getByRole("article", { name: /learning time/iu })).toContainText("2 min");
      await expectAccessibleScreen(page, "Activity");

      const activityChart = page.getByRole("figure", { name: /learning activity/iu });
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
      await expect(page.getByText(ACTIVE_DAY_LABEL)).toBeVisible();

      // The arrow keys move to the empty days around it.
      await activeDay.focus();
      await activeDay.press("ArrowLeft");
      await expect(page.getByText(EMPTY_DAY_LABEL)).toBeVisible();
    } finally {
      await context.close();
    }
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
    await expectAccessibleScreen(page, "Activity");

    await browserContext.close();
  });
});
