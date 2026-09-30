import { expect, test } from "./fixtures";
import { expectMode, showInMode } from "./learn-personas";

const CHART_SIZE_WARNING = "The width(-1) and height(-1) of chart should be greater than 0";

test.describe("Progress Charts", () => {
  test("Score trend renders without invalid size warnings", async ({
    browser,
    withProgressUser,
  }) => {
    const context = await browser.newContext({ storageState: withProgressUser.storageState });
    await showInMode(context, { mode: "fun", userId: withProgressUser.id });
    const page = await context.newPage();
    const chartWarnings: string[] = [];

    page.on("console", (message) => {
      if (message.text().includes(CHART_SIZE_WARNING)) {
        chartWarnings.push(message.text());
      }
    });

    try {
      await page.goto("/score");
      await expectMode(page, "fun");
      await expect(page.getByRole("figure", { name: /weekly score trend/iu })).toBeVisible();
      expect(chartWarnings).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
