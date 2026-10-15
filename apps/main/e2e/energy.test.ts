import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";

const DAYS_OUTSIDE_CHART = 400;

test.describe("Energy Page", () => {
  test("shows Energy now and its lifetime numbers on tiles, its past 12 months as a heatmap with its key, and one line on how it moves", async ({
    baseURL,
    browser,
  }) => {
    const user = await createE2EUser(baseURL!, { orgRole: "member" });
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const todayLabel = new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(today);

    const historicalDate = new Date(today.getTime() - DAYS_OUTSIDE_CHART * MS_PER_DAY);

    await Promise.all([
      userProgressFixture({ currentEnergy: 50, lastActiveAt: now, userId: user.id }),
      dailyProgressFixtureMany([
        { date: historicalDate, energyAtEnd: 100, timeSpentSeconds: 1200, userId: user.id },
        { date: today, energyAtEnd: 50, userId: user.id },
      ]),
    ]);

    const browserContext = await browser.newContext({ storageState: user.storageState });

    const page = await browserContext.newPage();

    try {
      await page.goto("/energy");

      const energyChart = page.getByRole("figure", { name: /past 12 months/iu });

      await expect(page.getByRole("main").getByText(/^50%$/u)).toBeVisible();
      await expect(energyChart).toBeVisible();

      // The readout starts on today, the newest day with Energy, in the mono face's short form.
      await expect(energyChart.locator('[data-slot="contribution-calendar-readout"]')).toHaveText(
        `${todayLabel} · 50% Energy`,
      );

      // The day at 100% is older than the chart, so no square has the top shade.
      await expect(
        energyChart.locator('[data-slot="contribution-calendar-day"].bg-energy'),
      ).toHaveCount(0);

      await expect(
        energyChart.getByRole("group", { name: "Energy intensity from low to high" }),
      ).toContainText(/Low\s*High/u);

      // Over the whole history, that day still counts as one at its maximum.
      const tiles = page.getByRole("main").locator('[data-slot="stat-tile"]');
      // Across 401 days: 100 down to 1, then 300 idle days at 0, and today's 50.
      // (5050 + 50) / 401 = 12.7%, including the days without a stored completion.
      await expect(tiles.filter({ hasText: /^Average/u })).toContainText("12.7%");
      await expect(tiles.filter({ hasText: /^At 100%/u })).toContainText("1 day");

      await expect(
        page.getByText(
          "Every lesson you finish raises your Energy. On days off it drops a little, and your belt and progress stay.",
        ),
      ).toBeVisible();
    } finally {
      await browserContext.close();
    }
  });

  test("says when Energy starts on the learner's first day of study, as the buddy does", async ({
    baseURL,
    browser,
  }) => {
    const user = await createE2EUser(baseURL!, { orgRole: "member" });
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    await Promise.all([
      userProgressFixture({ currentEnergy: 2, lastActiveAt: now, userId: user.id }),
      dailyProgressFixtureMany([
        { date: today, energyAtEnd: 2, timeSpentSeconds: 600, userId: user.id },
      ]),
    ]);

    const browserContext = await browser.newContext({ storageState: user.storageState });

    const page = await browserContext.newPage();
    const starts = "Energy starts after your first day of study, and grows as you learn.";

    try {
      await page.goto("/energy");
      await expect(page.getByRole("main").getByText(starts)).toBeVisible();
      await expect(page.getByRole("main").getByText(/^2%$/u)).toHaveCount(0);

      // The overview's Energy tile says it isn't there yet; its page says when it starts.
      await page.goto("/stats");
      const overview = page.getByRole("main");

      await expect(overview.getByRole("link", { name: "Energy Not yet" })).toBeVisible();
      await expect(overview.getByRole("link", { name: /^Energy \d+%/u })).toHaveCount(0);
    } finally {
      await browserContext.close();
    }
  });
});
