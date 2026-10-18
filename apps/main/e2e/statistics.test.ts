import { type Page } from "@playwright/test";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";

const PHONE = { height: 812, width: 375 };

/** Statistics and every stats page share one empty state, for visitors and for new learners. */
const STATS_PAGES = [
  { path: "/stats", title: "Statistics" },
  { path: "/level", title: "Level" },
  { path: "/energy", title: "Energy" },
  { path: "/activity", title: "Activity" },
  { path: "/score", title: "Score" },
  { path: "/patterns", title: "Patterns" },
] as const;

type StatsPage = (typeof STATS_PAGES)[number];

/** Opens a stats page and checks it shows its title and the empty state's prompt. */
async function expectEmptyState({
  page,
  prompt,
  statsPage,
}: {
  page: Page;
  prompt: RegExp;
  statsPage: StatsPage;
}) {
  await page.goto(statsPage.path);
  await expect(page.getByRole("heading", { level: 1, name: statsPage.title })).toBeVisible();
  await expect(page.getByRole("main").getByText(prompt)).toBeVisible();
}

async function expectNoHorizontalScroll(page: Page) {
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );

  expect(hasHorizontalOverflow).toBe(false);
}

test.describe("Statistics", () => {
  test("is a section: it opens on the overview, whose stats each open their page and lead back to it, and the overview leads back to the app", async ({
    browser,
    withProgressUser,
  }) => {
    const context = await browser.newContext({
      storageState: withProgressUser.storageState,
      viewport: PHONE,
    });

    const page = await context.newPage();

    try {
      // The level beside the avatar opens Statistics from any tab.
      await page.goto("/buddy");
      await page.getByRole("link", { name: "Orange belt, level 8. Statistics" }).click();
      await expect(page).toHaveURL(/\/stats$/u);

      const main = page.getByRole("main");
      const bar = page.getByRole("main");

      await expect(main.getByRole("heading", { level: 1, name: "Statistics" })).toBeVisible();

      // A section's bar: the way back, with the app's tabs; on a phone no sidebar either.
      await expect(page.getByRole("navigation", { name: "Learning tabs" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Your stats" })).toHaveCount(0);

      // Four numbers on tiles, each opening its page; the year of study as a calendar; the best
      // day and time as a row.
      const level = main.getByRole("link", { name: "Level 8" });
      await expect(level).toHaveAttribute("href", "/level");

      await expect(main.getByRole("link", { name: /^Energy \d+%$/u })).toHaveAttribute(
        "href",
        "/energy",
      );

      const activity = main.getByRole("link", { name: "Study days 1" });
      await expect(activity).toHaveAttribute("href", "/activity");

      await expect(main.getByRole("link", { name: /^Score \d+(?:\.\d+)?%$/u })).toHaveAttribute(
        "href",
        "/score",
      );

      await expect(main.getByRole("figure", { name: /past 12 months/iu })).toBeVisible();

      // A phone shows the best day and time as one row, opening the full patterns.
      await expect(main.getByRole("link", { name: /^Patterns/u })).toContainText(
        /\w+ · (?:Night|Morning|Afternoon|Evening)/iu,
      );

      await expectNoHorizontalScroll(page);
      await expectAccessibleScreen(page, "Statistics");

      await level.click();
      await expect(page).toHaveURL(/\/level$/u);
      await expect(main.getByRole("heading", { level: 1, name: "Level" })).toBeVisible();

      // A stat's page goes back to the overview, which goes back to the tab the learner left.
      await bar.getByRole("link", { name: "Back to Statistics" }).click();
      await expect(page).toHaveURL(/\/stats$/u);

      await activity.click();
      await expect(page).toHaveURL(/\/activity$/u);
      await expect(main.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();

      await bar.getByRole("link", { name: "Back to Statistics" }).click();
      await expect(page).toHaveURL(/\/stats$/u);
      await bar.getByRole("link", { exact: true, name: "Back" }).click();
      await expect(page).toHaveURL(/\/buddy$/u);

      // Returning to Plan must keep its history entry eligible on another Statistics visit.
      await page.setViewportSize({ height: 900, width: 1440 });
      const sidebar = page.getByRole("complementary", { name: "Sidebar" });
      const tabs = sidebar.getByRole("navigation", { name: "Learning tabs" });

      await tabs.getByRole("link", { exact: true, name: "Today" }).click();
      await expect(page).toHaveURL(/\/today$/u);
      await tabs.getByRole("link", { exact: true, name: "Plan" }).click();
      await expect(page).toHaveURL(/\/plan$/u);
      await sidebar.getByRole("link", { exact: true, name: "Statistics" }).click();
      await expect(page).toHaveURL(/\/stats$/u);
      await page.setViewportSize(PHONE);
      await bar.getByRole("link", { exact: true, name: "Back" }).click();
      await expect(page).toHaveURL(/\/plan$/u);

      await page.getByRole("link", { name: "Orange belt, level 8. Statistics" }).click();
      await expect(page).toHaveURL(/\/stats$/u);
      await bar.getByRole("link", { exact: true, name: "Back" }).click();
      await expect(page).toHaveURL(/\/plan$/u);
    } finally {
      await context.close();
    }
  });

  test("on a wide screen keeps the app's sidebar, with the stats as tabs under the section's title", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ height: 860, width: 1280 });
    await page.goto("/energy");

    await expect(page.getByRole("heading", { level: 1, name: "Energy" })).toBeAttached();
    await expect(page.getByRole("complementary", { name: "Sidebar" })).toBeVisible();

    const stats = page.getByRole("navigation", { name: "Your stats" });

    await expect(stats.getByRole("link", { exact: true, name: "Energy" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // Every stats page keeps the section's title where it was: moving between tabs moves nothing.
    const title = page.locator('[data-slot="section-title"]');
    const energyTop = await title.evaluate((element) => element.getBoundingClientRect().top);

    await stats.getByRole("link", { exact: true, name: "Overview" }).click();
    await expect(page).toHaveURL(/\/stats$/u);
    await expect(page.getByRole("heading", { level: 1, name: "Statistics" })).toBeAttached();

    await expect
      .poll(() => title.evaluate((element) => element.getBoundingClientRect().top))
      .toBe(energyTop);

    // On a wide screen the overview is a dashboard: Score's trend beside the best day and time.
    await expect(page.getByRole("region", { name: "Score · 90 days" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Patterns · 90 days" })).toBeVisible();
  });

  test("ask visitors to log in and come back to the page, or start free, as every gated page does", async ({
    page,
  }) => {
    for (const statsPage of STATS_PAGES) {
      // oxlint-disable-next-line no-await-in-loop -- One page visits each stats page in turn.
      await expectEmptyState({
        page,
        prompt: /log in to pick up where you left off, or start free/iu,
        statsPage,
      });

      const main = page.getByRole("main");

      // oxlint-disable-next-line no-await-in-loop -- One page visits each stats page in turn.
      await expect(main.getByRole("link", { name: "Log in" })).toHaveAttribute(
        "href",
        `/login?next=${encodeURIComponent(statsPage.path)}`,
      );
      // oxlint-disable-next-line no-await-in-loop -- One page visits each stats page in turn.
      await expect(main.getByRole("link", { name: "Start free" })).toHaveAttribute(
        "href",
        "/start",
      );
    }
  });

  test("ask learners without progress to start learning", async ({ userWithoutProgress }) => {
    for (const statsPage of STATS_PAGES) {
      // oxlint-disable-next-line no-await-in-loop -- One page visits each stats page in turn.
      await expectEmptyState({
        page: userWithoutProgress,
        prompt: /start learning to track your progress/iu,
        statsPage,
      });
    }
  });

  test("each page fits a phone: a headline, its chart and its numbers", async ({
    browser,
    withProgressUser,
  }) => {
    const context = await browser.newContext({
      storageState: withProgressUser.storageState,
      viewport: PHONE,
    });

    const page = await context.newPage();

    try {
      await page.goto("/score");
      await expect(page.getByRole("figure", { name: /weekly score trend/iu })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectAccessibleScreen(page, "Score");

      await page.goto("/patterns");

      await expect(
        page.getByRole("region", { name: "Throughout the week" }).getByRole("listitem"),
      ).toHaveCount(7);

      await expectNoHorizontalScroll(page);
      await expectAccessibleScreen(page, "Patterns");

      // Energy leads with its numbers on tiles, now first, then the year as a heatmap.
      await page.goto("/energy");

      await expect(
        page.locator('[data-slot="stat-tile"]').filter({ hasText: /^Energy/u }),
      ).toContainText(/\d+%/u);

      await expect(page.getByRole("figure", { name: /past 12 months/iu })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectAccessibleScreen(page, "Energy");
    } finally {
      await context.close();
    }
  });
});
