import { type Browser } from "@playwright/test";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
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
  browserLocale,
  totalBrainPower,
}: {
  baseURL: string;
  browser: Browser;
  browserLocale?: string;
  totalBrainPower: bigint;
}) {
  const user = await createE2EUser(baseURL, { orgRole: "member" });
  await userProgressFixture({ totalBrainPower, userId: user.id });

  const browserContext = await browser.newContext({
    locale: browserLocale,
    storageState: user.storageState,
  });

  const page = await browserContext.newPage();

  return { browserContext, page };
}

test.describe("Level Page", () => {
  test("shows the belt, how far the next level is and the Brain Power total, in the app's locale", async ({
    baseURL,
    browser,
  }) => {
    const { browserContext, page } = await createLevelTestPage({
      baseURL: baseURL!,
      browser,
      browserLocale: "en-US",
      totalBrainPower: 15_000n,
    });

    try {
      await page.goto("/level");
      const tiles = page.locator('[data-slot="stat-tile"]');

      await expect(page.getByRole("heading", { level: 1, name: /^level$/iu })).toBeAttached();

      // The level in its belt, the Brain Power behind it and what the next level takes, on tiles.
      await expect(tiles.filter({ hasText: /^Level/u })).toContainText(/8\s*Orange belt/u);
      await expect(tiles.filter({ hasText: /^Brain Power/u })).toContainText("15,000");

      // Brain Power is written out, never abbreviated.
      await expect(tiles.filter({ hasText: /^To level 9/u })).toContainText("500 Brain Power");
      await expect(page.getByText(/\bBP\b/u)).toHaveCount(0);

      await expect(page.getByRole("heading", { name: /belt progression/iu })).toBeVisible();

      await expect(
        page.getByText("Every lesson adds 10 Brain Power, and it never goes down."),
      ).toBeVisible();

      // The app's locale formats the numbers, not the browser's.
      await page.goto("/de/level");

      await expect(tiles.nth(1)).toContainText(new Intl.NumberFormat("de").format(15_000));
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

      const tiles = page.locator('[data-slot="stat-tile"]');

      await expect(tiles.filter({ hasText: /^Level/u })).toContainText(/10\s*Black belt/u);
      await expect(tiles.filter({ hasText: /^Next level/u })).toContainText("Max level reached");
      await expectAccessibleScreen(page, "Level");
    } finally {
      await browserContext.close();
    }
  });
});
