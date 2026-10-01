import { type Page } from "@playwright/test";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { expectMode, showInMode } from "./learn-personas";

const DAYS_OUTSIDE_CHART = 400;
const DERIVED_LIFETIME_AVERAGE_ENERGY = "12.7%";
const PHONE = { height: 812, width: 375 };

/** Every stats page shares one empty state, for visitors and for learners with nothing yet. */
const STATS_PAGES = [
  { path: "/energy", title: "Energy" },
  { path: "/level", title: "Level" },
  { path: "/score", title: "Score" },
  { path: "/activity", title: "Activity" },
  { path: "/patterns", title: "Patterns" },
] as const;

type StatsPage = (typeof STATS_PAGES)[number];

/**
 * Records the requested scroll behavior while preserving the browser's native
 * scrolling so the test can verify both the animation contract and the final
 * visible state.
 */
async function recordScrollIntoViewBehavior(page: Page) {
  await page.addInitScript(() => {
    // oxlint-disable-next-line typescript/unbound-method -- The wrapper must preserve the native DOM method before replacing it.
    const nativeScrollIntoView = Element.prototype.scrollIntoView;

    Element.prototype.scrollIntoView = function scrollIntoView(
      options?: boolean | ScrollIntoViewOptions,
    ) {
      const behavior = typeof options === "object" ? options.behavior : undefined;

      Reflect.set(globalThis, "progressScrollBehavior", behavior);
      nativeScrollIntoView.call(this, options);
    };
  });
}

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

test.describe("Stats pages", () => {
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

  test("fit a phone, with the stats in priority order and the active one smoothly in view", async ({
    browser,
    withProgressUser,
  }) => {
    const context = await browser.newContext({
      storageState: withProgressUser.storageState,
      viewport: PHONE,
    });

    const page = await context.newPage();

    try {
      await recordScrollIntoViewBehavior(page);
      await page.goto("/energy");

      const stats = page.getByRole("navigation", { name: "Your stats" });
      const statLinks = stats.getByRole("link");

      await expect(statLinks).toHaveCount(6);
      await expect(statLinks.nth(0)).toHaveAccessibleName("Progress");
      await expect(statLinks.nth(1)).toHaveAccessibleName("Activity");
      await expect(statLinks.nth(2)).toHaveAccessibleName("Score");
      await expect(statLinks.nth(3)).toHaveAccessibleName("Patterns");
      await expect(statLinks.nth(4)).toHaveAccessibleName("Level");
      await expect(statLinks.nth(5)).toHaveAccessibleName("Energy");

      const energyLink = stats.getByRole("link", { name: "Energy" });
      await expect(energyLink).toHaveAttribute("aria-current", "page");

      await expect
        .poll(() =>
          page.evaluate(() => {
            const behavior: unknown = Reflect.get(globalThis, "progressScrollBehavior");

            return typeof behavior === "string" ? behavior : null;
          }),
        )
        .toBe("smooth");

      await expect(energyLink).toBeInViewport({ ratio: 1 });
      await expectAccessibleScreen(page, "Energy");

      await page.goto("/score");
      await expect(page.getByRole("figure", { name: /weekly score trend/iu })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectAccessibleScreen(page, "Score");

      await page.goto("/patterns");
      const weeklyRhythm = page.getByRole("region", { name: /weekly rhythm/iu });
      const dailyRhythm = page.getByRole("region", { name: /throughout the day/iu });

      await expect(weeklyRhythm.getByRole("button")).toHaveCount(7);
      await expect(dailyRhythm.getByRole("article")).toHaveCount(4);
      await expectNoHorizontalScroll(page);
      await expectAccessibleScreen(page, "Patterns");
    } finally {
      await context.close();
    }
  });
});

test.describe("Energy Page", () => {
  test("shows the Energy calendar and all-time metrics without date controls", async ({
    baseURL,
    browser,
  }) => {
    const user = await createE2EUser(baseURL!, { orgRole: "member" });
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const todayLabel = new Intl.DateTimeFormat("en", {
      dateStyle: "short",
      timeZone: "UTC",
    }).format(today);

    const historicalDate = new Date(today.getTime() - DAYS_OUTSIDE_CHART * MS_PER_DAY);

    await Promise.all([
      userProgressFixture({ currentEnergy: 50, lastActiveAt: now, userId: user.id }),
      dailyProgressFixtureMany([
        { date: historicalDate, energyAtEnd: 100, userId: user.id },
        { date: today, energyAtEnd: 50, userId: user.id },
      ]),
    ]);

    const browserContext = await browser.newContext({
      storageState: user.storageState,
      timezoneId: "UTC",
    });

    await showInMode(browserContext, { mode: "fun", userId: user.id });
    const page = await browserContext.newPage();

    try {
      await page.goto("/energy");
      await expectMode(page, "fun");

      const averageEnergyCard = page.getByRole("article", { name: /average energy/iu });
      const energyBattery = page.getByRole("progressbar", { name: /your energy/iu });
      const fullEnergyCard = page.getByRole("article", { name: /days at max energy/iu });
      const energyChart = page.getByRole("figure", { name: /energy history/iu });

      const recordedEnergyDay = energyChart.getByRole("button", {
        exact: true,
        name: `50% Energy on ${todayLabel}`,
      });

      await expect(energyBattery).toHaveAttribute("aria-valuemin", "0");
      await expect(energyBattery).toHaveAttribute("aria-valuemax", "100");
      await expect(energyBattery).toHaveAttribute("aria-valuenow", "50");
      await expect(energyBattery).toHaveAttribute("aria-valuetext", "50%");
      await expect(page.getByText(/^50%$/u)).toBeVisible();
      await expect(averageEnergyCard).toContainText(DERIVED_LIFETIME_AVERAGE_ENERGY);
      await expect(fullEnergyCard).toContainText("1 day");
      await expect(energyChart).toBeVisible();
      await expect(recordedEnergyDay).toBeVisible();
      await expectAccessibleScreen(page, "Energy");

      await expect(energyChart.getByRole("button", { name: /^max energy on /iu })).toHaveCount(0);

      await expect(page.getByRole("navigation", { name: /period selection/iu })).toHaveCount(0);

      await expect(page.getByRole("button", { name: /previous period|next period/iu })).toHaveCount(
        0,
      );
    } finally {
      await browserContext.close();
    }
  });
});
