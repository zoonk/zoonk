import { expect, test } from "./fixtures";

const CHART_SIZE_WARNING = "The width(-1) and height(-1) of chart should be greater than 0";

test.describe("Score", () => {
  test("shows one weighted 90-day score with its answers, the weekly trend and one line", async ({
    browser,
    withProgressUser,
  }) => {
    const context = await browser.newContext({ storageState: withProgressUser.storageState });
    const page = await context.newPage();
    const chartWarnings: string[] = [];

    page.on("console", (message) => {
      if (message.text().includes(CHART_SIZE_WARNING)) {
        chartWarnings.push(message.text());
      }
    });

    try {
      await page.goto("/score");

      await expect(
        page.getByRole("heading", { exact: true, level: 1, name: "Score" }),
      ).toBeVisible();

      const scoreSummary = page.getByRole("region", { name: /score summary/iu });
      const scoreChart = page.getByRole("figure", { name: /weekly score trend/iu });

      await expect(scoreSummary).toContainText(/\d+(?:\.\d+)?%/u);
      await expect(scoreSummary).toContainText(/\d+ of \d+ answers right in the last 90 days/iu);
      await expect(scoreChart).toBeVisible();

      // The 90-day window is said once, in the headline.
      await expect(page.getByText(/90 days/iu)).toHaveCount(1);

      // The trend renders at its size, without the chart library's invalid size warnings.
      expect(chartWarnings).toEqual([]);

      await expect(
        page.getByText(
          "Every answer counts the same, so harder lessons can lower your score for a while.",
        ),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
