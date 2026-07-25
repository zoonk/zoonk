import { prisma } from "@zoonk/db";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { getContributionCalendarDateRange } from "@zoonk/utils/contribution-calendar";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";

const DAYS_OUTSIDE_CHART = 400;
const DERIVED_LIFETIME_AVERAGE_ENERGY = "12.7%";

const ENERGY_TIME_ZONE_CANDIDATES = [
  "Pacific/Honolulu",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Pacific/Kiritimati",
];

/**
 * Keeping the E2E clock at least six hours from midnight prevents fixture
 * setup and the following server render from landing on different local days.
 */
function getStableEnergyTimeZone(): string {
  const now = new Date();

  return (
    ENERGY_TIME_ZONE_CANDIDATES.find((timeZone) => {
      const hour = Number(
        new Intl.DateTimeFormat("en", { hour: "numeric", hourCycle: "h23", timeZone }).format(now),
      );

      return hour >= 6 && hour <= 18;
    }) ?? "UTC"
  );
}

const ENERGY_TIME_ZONE = getStableEnergyTimeZone();

/**
 * Creates sparse authoritative activity days so the Energy page must derive
 * inactive dates without writing synthetic DailyProgress records.
 */
async function createSparseEnergyUser({
  baseURL,
  timeZone,
}: {
  baseURL: string;
  timeZone: string;
}) {
  const user = await createE2EUser(baseURL, { orgRole: "member" });
  const today = getContributionCalendarDateRange({ now: new Date(), timeZone }).endDate;
  const firstDate = new Date(today.getTime() - 4 * MS_PER_DAY);
  const laterDate = new Date(today.getTime() - 2 * MS_PER_DAY);

  await Promise.all([
    userProgressFixture({
      currentEnergy: 48,
      lastActiveAt: new Date(Date.now() - 2 * MS_PER_DAY),
      totalBrainPower: 100n,
      userId: user.id,
    }),
    dailyProgressFixtureMany([
      { date: firstDate, energyAtEnd: 50, interactiveCompleted: 1, userId: user.id },
      { date: laterDate, energyAtEnd: 48, staticCompleted: 1, userId: user.id },
    ]),
  ]);

  return { today, user };
}

test.describe("Energy Page", () => {
  test.describe("Unauthenticated Users", () => {
    test("shows login prompt with link to login page", async ({ page }) => {
      await page.goto("/energy");

      // User sees prompt to log in
      await expect(page.getByText(/log in to track your progress/iu)).toBeVisible();

      // Login link points to correct destination
      await expect(page.getByRole("link", { name: /login/iu })).toHaveAttribute("href", "/login");
    });
  });

  test.describe("Authenticated Users", () => {
    test("shows progress navigation in metric priority order", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/energy");

      const navigationLinks = authenticatedPage.getByRole("navigation").getByRole("link");

      await expect(navigationLinks).toHaveCount(6);
      await expect(navigationLinks.nth(0)).toHaveAccessibleName("Home page");
      await expect(navigationLinks.nth(1)).toHaveAccessibleName("Activity");
      await expect(navigationLinks.nth(2)).toHaveAccessibleName("Score");
      await expect(navigationLinks.nth(3)).toHaveAccessibleName("Patterns");
      await expect(navigationLinks.nth(4)).toHaveAccessibleName("Level");
      await expect(navigationLinks.nth(5)).toHaveAccessibleName("Energy");
    });

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

      const page = await browserContext.newPage();

      try {
        await page.goto("/energy");

        await expect.poll(() => prisma.dailyProgress.count({ where: { userId: user.id } })).toBe(2);

        const averageEnergyCard = page.getByRole("article", { name: /average energy/iu });
        const energyBattery = page.getByRole("progressbar", { name: /your energy/iu });
        const fullEnergyCard = page.getByRole("article", { name: /days at 100% energy/iu });
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

        await expect(energyChart.getByRole("button", { name: /^100% energy on /iu })).toHaveCount(
          0,
        );

        await expect(page.getByRole("navigation", { name: /period selection/iu })).toHaveCount(0);

        await expect(
          page.getByRole("button", { name: /previous period|next period/iu }),
        ).toHaveCount(0);
      } finally {
        await browserContext.close();
      }
    });

    test(`derives sparse Energy gaps in ${ENERGY_TIME_ZONE}`, async ({ baseURL, browser }) => {
      const { today, user } = await createSparseEnergyUser({
        baseURL: baseURL!,
        timeZone: ENERGY_TIME_ZONE,
      });

      const browserContext = await browser.newContext({
        extraHTTPHeaders: { "x-vercel-ip-timezone": ENERGY_TIME_ZONE },
        storageState: user.storageState,
        timezoneId: ENERGY_TIME_ZONE,
      });

      const page = await browserContext.newPage();

      try {
        await page.goto("/");

        const energyCard = page.getByRole("article", { name: /^energy$/iu });

        await expect(energyCard).toContainText("47%");
        await page.getByRole("link").filter({ has: energyCard }).click();
        await expect(page).toHaveURL(/\/energy/u);

        await expect(page.getByRole("progressbar", { name: /your energy/iu })).toHaveAttribute(
          "aria-valuenow",
          "47",
        );

        const previousDate = new Intl.DateTimeFormat("en", {
          dateStyle: "short",
          timeZone: "UTC",
        }).format(new Date(today.getTime() - MS_PER_DAY));

        await expect(
          page.getByRole("button", { exact: true, name: `47% Energy on ${previousDate}` }),
        ).toBeVisible();

        await expect.poll(() => prisma.dailyProgress.count({ where: { userId: user.id } })).toBe(2);
      } finally {
        await browserContext.close();
      }
    });
  });

  test.describe("Users Without Progress", () => {
    test("sees prompt to start learning", async ({ userWithoutProgress }) => {
      await userWithoutProgress.goto("/energy");

      await expect(
        userWithoutProgress.getByText(/start learning to track your progress/iu),
      ).toBeVisible();
    });
  });
});
