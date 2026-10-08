import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";

const ACTIVE_DAY_LABEL = /^1 activity finished on /iu;
const EMPTY_DAY_LABEL = /^No study on /iu;

test.describe("Activity Page", () => {
  test("learners see their study days, the calendar that lights them and inspect its days", async ({
    browser,
    withProgressUser,
  }) => {
    const context = await browser.newContext({ storageState: withProgressUser.storageState });
    const page = await context.newPage();

    try {
      await page.goto("/activity");

      await expect(page.getByRole("heading", { level: 1, name: /^activity$/iu })).toBeVisible();

      // The headline and the calendar count the same days: one finished lesson today.
      await expect(page.getByText("1 day", { exact: true })).toBeVisible();
      await expect(page.getByText("1 lesson finished and 2 min of study in total.")).toBeVisible();

      const activityChart = page.getByRole("figure", { name: /past 12 months/iu });
      const days = activityChart.getByRole("group", { name: "Activity by day" });
      const readout = activityChart.locator('[data-slot="contribution-calendar-readout"]');

      // A year of small squares, one control: the readout starts on the newest day studied.
      await expect(activityChart).toBeVisible();
      await expect(activityChart.getByRole("button")).toHaveCount(0);
      await expect(activityChart.getByText(/^Mon$/u)).toHaveCount(0);
      await expect(readout).toHaveText(ACTIVE_DAY_LABEL);

      // The pointer reads the day under it, and the arrow keys move from there.
      await days.locator('[data-slot="contribution-calendar-day"]').first().hover();
      await expect(readout).toHaveText(EMPTY_DAY_LABEL);

      await days.focus();
      await page.keyboard.press("ArrowRight");
      await expect(readout).toHaveText(EMPTY_DAY_LABEL);
      await expect(days.locator("[data-active]")).toHaveCount(1);
    } finally {
      await context.close();
    }
  });

  test("learners can tap a day to read it", async ({ browser, withProgressUser }) => {
    const browserContext = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      storageState: withProgressUser.storageState,
      viewport: { height: 812, width: 375 },
    });

    const page = await browserContext.newPage();
    await page.goto("/activity");

    const days = page.getByRole("group", { name: "Activity by day" });
    const readout = page.locator('[data-slot="contribution-calendar-readout"]');

    await days.locator('[data-slot="contribution-calendar-day"]').last().tap();
    await expect(readout).toHaveText(/ on /u);
    await expect(days.locator("[data-active]")).toHaveCount(1);
    await expectAccessibleScreen(page, "Activity");

    await browserContext.close();
  });
});
