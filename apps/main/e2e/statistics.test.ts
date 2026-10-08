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
  await expect(page.getByText(prompt)).toBeVisible();
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
      const bar = page.getByRole("banner");

      await expect(main.getByRole("heading", { level: 1, name: "Statistics" })).toBeVisible();

      // A section's bar: the way back, without the app's tabs; on a phone no sidebar either.
      await expect(page.getByRole("navigation", { name: "Learning tabs" })).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Your stats" })).toHaveCount(0);

      // One card per stat, each with its number: the belt leads, Energy shows its last weeks.
      const links = main.getByRole("link");

      await expect(links).toHaveText([
        /^Level\s*Orange belt · level 8/u,
        /^Energy\s*\d+%/u,
        /^Activity\s*1 day/u,
        /^Score\s*\d+(?:\.\d+)?%/u,
        /^Patterns\s*\w+ · (?:Night|Morning|Afternoon|Evening)/u,
      ]);

      await expectNoHorizontalScroll(page);
      await expectAccessibleScreen(page, "Statistics");

      await links.filter({ hasText: "Orange belt" }).click();
      await expect(page).toHaveURL(/\/level$/u);
      await expect(main.getByRole("heading", { level: 1, name: "Level" })).toBeVisible();

      // A stat's page goes back to the overview, which goes back to the tab the learner left.
      await bar.getByRole("link", { name: "Back to Statistics" }).click();
      await expect(page).toHaveURL(/\/stats$/u);

      await links.filter({ hasText: "Activity" }).click();
      await expect(page).toHaveURL(/\/activity$/u);
      await expect(main.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();

      await bar.getByRole("link", { name: "Back to Statistics" }).click();
      await expect(page).toHaveURL(/\/stats$/u);
      await bar.getByRole("link", { exact: true, name: "Back" }).click();
      await expect(page).toHaveURL(/\/buddy$/u);
    } finally {
      await context.close();
    }
  });

  test("ask visitors to log in", async ({ page }) => {
    for (const statsPage of STATS_PAGES) {
      // oxlint-disable-next-line no-await-in-loop -- One page visits each stats page in turn.
      await expectEmptyState({ page, prompt: /log in to track your progress/iu, statsPage });
      // oxlint-disable-next-line no-await-in-loop -- One page visits each stats page in turn.
      await expect(page.getByRole("link", { name: /login/iu })).toHaveAttribute("href", "/login");
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
        page.getByRole("region", { name: /weekly rhythm/iu }).getByRole("button"),
      ).toHaveCount(7);

      await expectNoHorizontalScroll(page);
      await expectAccessibleScreen(page, "Patterns");

      // Energy leads with its value, then the year as a heatmap.
      await page.goto("/energy");
      await expect(page.locator('[data-slot="progress-headline-value"]')).toHaveText(/^\d+%$/u);
      await expect(page.getByRole("figure", { name: /past 12 months/iu })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectAccessibleScreen(page, "Energy");
    } finally {
      await context.close();
    }
  });
});
