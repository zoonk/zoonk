import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";
import { expectMode, showInMode } from "./learn-personas";

const CHART_SIZE_WARNING = "The width(-1) and height(-1) of chart should be greater than 0";

test.describe("Score", () => {
  test("shows one weighted 90-day score with its denominator, weekly trend and explanation", async ({
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

      await expect(
        page.getByRole("heading", { exact: true, level: 1, name: "Score" }),
      ).toBeVisible();

      const scoreSummary = page.getByRole("region", { name: /score summary/iu });
      const scoreChart = page.getByRole("figure", { name: /weekly score trend/iu });

      await expect(scoreSummary).toContainText(/\d+(?:\.\d+)?%/u);
      await expect(scoreSummary).toContainText(/\d+ of \d+ answers correct/iu);
      await expect(scoreChart).toBeVisible();
      await expect(scoreChart).toContainText(/past 90 days/iu);
      await expect(scoreChart).toContainText(/\d+ answers/iu);
      await expect(page.getByRole("navigation", { name: /period selection/iu })).toHaveCount(0);

      await expect(page.getByRole("button", { name: /previous period|next period/iu })).toHaveCount(
        0,
      );

      // The trend renders at its size, without the chart library's invalid size warnings.
      expect(chartWarnings).toEqual([]);
      await expectAccessibleScreen(page, "Score");

      // One concise section explains Score.
      await expect(page.getByRole("heading", { name: /what is score/iu })).toBeVisible();

      await expect(
        page.getByText(/percentage of questions you answered correctly/iu),
      ).toBeVisible();

      await expect(page.getByRole("heading", { name: /how do i improve score/iu })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: /why is score important/iu })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
