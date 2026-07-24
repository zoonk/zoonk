import { type Browser } from "@playwright/test";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { expect, test } from "./fixtures";

/**
 * Creates an isolated learner at an exact Brain Power total so Level assertions
 * describe belt rules directly instead of depending on shared seed progress.
 */
async function createLevelTestPage({
  baseURL,
  browser,
  totalBrainPower,
}: {
  baseURL: string;
  browser: Browser;
  totalBrainPower: bigint;
}) {
  const user = await createE2EUser(baseURL, { orgRole: "member" });
  await userProgressFixture({ totalBrainPower, userId: user.id });

  const browserContext = await browser.newContext({ storageState: user.storageState });
  const page = await browserContext.newPage();

  return { browserContext, page };
}

test.describe("Level Page", () => {
  test.describe("Unauthenticated Users", () => {
    test("shows login prompt with link to login page", async ({ page }) => {
      await page.goto("/level");

      await expect(page.getByText(/log in to track your progress/iu)).toBeVisible();
      await expect(page.getByRole("link", { name: /login/iu })).toHaveAttribute("href", "/login");
    });
  });

  test.describe("Authenticated Users", () => {
    test("shows the current level and the progress that moves learning forward", async ({
      baseURL,
      browser,
    }) => {
      const { browserContext, page } = await createLevelTestPage({
        baseURL: baseURL!,
        browser,
        totalBrainPower: 15_000n,
      });

      try {
        await page.goto("/level");

        await expect(page.getByRole("heading", { level: 1, name: /^level$/iu })).toBeVisible();
        await expect(page.getByText(/^orange belt · level 8$/iu)).toBeVisible();
        await expect(page.getByText(/^500 bp to next level$/iu)).toBeVisible();
        await expect(page.getByText(/^15,000 bp$/iu)).toBeVisible();

        const levelProgress = page.getByRole("progressbar", { name: /500 bp to next level/iu });

        await expect(levelProgress).toBeVisible();
        await expect(levelProgress).toHaveAttribute("aria-valuenow", "50");
        await expect(levelProgress).toContainText("500 of 1,000 BP");

        await expect(page.getByRole("heading", { name: /belt progression/iu })).toBeVisible();
        await expect(page.getByRole("heading", { name: /how levels work/iu })).toBeVisible();
        await expect(page.getByText(/brain power never goes down/iu)).toBeVisible();

        await expect(page.getByRole("navigation", { name: /period selection/iu })).toHaveCount(0);
        await expect(page.getByRole("figure", { name: /brain power chart/iu })).toHaveCount(0);
        await expect(page.getByRole("article", { name: /highest bp/iu })).toHaveCount(0);
      } finally {
        await browserContext.close();
      }
    });

    test("shows a completed milestone at the maximum level", async ({ baseURL, browser }) => {
      const { browserContext, page } = await createLevelTestPage({
        baseURL: baseURL!,
        browser,
        totalBrainPower: 3_067_500n,
      });

      try {
        await page.goto("/level");

        await expect(page.getByText(/^black belt · level 10$/iu)).toBeVisible();
        await expect(page.getByText(/^max level reached$/iu)).toBeVisible();

        const levelProgress = page.getByRole("progressbar", { name: /max level reached/iu });

        await expect(levelProgress).toHaveAttribute("aria-valuenow", "100");
        await expect(levelProgress).toContainText("Complete");
        await expect(levelProgress).not.toContainText("0 of 100,000 BP");
      } finally {
        await browserContext.close();
      }
    });
  });

  test.describe("Users Without Progress", () => {
    test("sees prompt to start learning", async ({ userWithoutProgress }) => {
      await userWithoutProgress.goto("/level");

      await expect(
        userWithoutProgress.getByText(/start learning to track your progress/iu),
      ).toBeVisible();
    });
  });
});
