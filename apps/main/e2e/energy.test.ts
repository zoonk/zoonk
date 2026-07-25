import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";

const DAYS_OUTSIDE_CHART = 400;

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
    test("navigates from home and sees current Energy", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/");

      // Wait for Progress section to load (indicates Suspense resolved)
      await expect(authenticatedPage.getByText(/^progress$/iu)).toBeVisible();

      // User opens the Energy card from the progress section
      const energyCard = authenticatedPage.getByRole("article", { name: /^energy$/iu });

      await authenticatedPage.getByRole("link").filter({ has: energyCard }).click();

      // Wait for navigation to energy page
      await expect(authenticatedPage).toHaveURL(/\/energy/u);

      // User sees the energy page heading
      await expect(authenticatedPage.getByRole("heading", { name: /^energy$/iu })).toBeVisible();

      await expect(
        authenticatedPage.getByRole("progressbar", { name: /your energy/iu }),
      ).toBeVisible();
    });

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
      const historicalDate = new Date(today.getTime() - DAYS_OUTSIDE_CHART * MS_PER_DAY);

      await Promise.all([
        userProgressFixture({ currentEnergy: 73, lastActiveAt: now, userId: user.id }),
        dailyProgressFixtureMany([
          { date: historicalDate, energyAtEnd: 100, userId: user.id },
          { date: today, energyAtEnd: 50, userId: user.id },
        ]),
      ]);

      const browserContext = await browser.newContext({ storageState: user.storageState });
      const page = await browserContext.newPage();

      try {
        await page.goto("/energy");

        const averageEnergyCard = page.getByRole("article", { name: /average energy/iu });
        const energyBattery = page.getByRole("progressbar", { name: /your energy/iu });
        const fullEnergyCard = page.getByRole("article", { name: /days at 100% energy/iu });
        const energyChart = page.getByRole("figure", { name: /energy history/iu });
        const recordedEnergyDay = energyChart.getByRole("button", { name: /^50% energy on /iu });

        await expect(energyBattery).toHaveAttribute("aria-valuemin", "0");
        await expect(energyBattery).toHaveAttribute("aria-valuemax", "100");
        await expect(energyBattery).toHaveAttribute("aria-valuenow", "73");
        await expect(energyBattery).toHaveAttribute("aria-valuetext", "73%");
        await expect(page.getByText(/^73%$/u)).toBeVisible();
        await expect(averageEnergyCard).toContainText("75%");
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

    test("keeps lifetime Energy visible when the calendar year is empty", async ({
      baseURL,
      browser,
    }) => {
      const user = await createE2EUser(baseURL!, { orgRole: "member" });
      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const historicalDate = new Date(today.getTime() - DAYS_OUTSIDE_CHART * MS_PER_DAY);

      await Promise.all([
        userProgressFixture({
          currentEnergy: 73,
          lastActiveAt: now,
          totalBrainPower: 100n,
          userId: user.id,
        }),
        dailyProgressFixtureMany([{ date: historicalDate, energyAtEnd: 100, userId: user.id }]),
      ]);

      const browserContext = await browser.newContext({ storageState: user.storageState });
      const page = await browserContext.newPage();

      try {
        await page.goto("/energy");

        await expect(page.getByText(/^73%$/u)).toBeVisible();
        await expect(page.getByRole("article", { name: /average energy/iu })).toContainText("100%");

        await expect(page.getByRole("article", { name: /days at 100% energy/iu })).toContainText(
          "1 day",
        );

        await expect(page.getByRole("figure", { name: /energy history/iu })).toBeVisible();
        await expect(page.getByText(/start learning to track your progress/iu)).toHaveCount(0);
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
