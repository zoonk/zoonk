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

      await expect(page.getByRole("heading", { level: 1, name: /^level$/iu })).toBeVisible();
      await expect(page.getByText(/^orange belt · level 8$/iu)).toBeVisible();

      // Brain Power is written out, never abbreviated.
      const levelProgress = page.getByRole("progressbar", {
        name: /^500 brain power to the next level$/iu,
      });

      await expect(levelProgress).toBeVisible();
      await expect(levelProgress).toHaveAttribute("aria-valuenow", "50");
      await expect(page.getByText(/\bBP\b/u)).toHaveCount(0);

      await expect(page.getByRole("heading", { name: /belt progression/iu })).toBeVisible();

      await expect(
        page.getByText(
          "You have 15,000 Brain Power. Every lesson adds 10, and it never goes down.",
        ),
      ).toBeVisible();

      // The app's locale formats the progress, not the browser's.
      await page.goto("/de/level");

      await expect(page.getByRole("progressbar", { name: /500 brain power/iu })).toHaveAttribute(
        "aria-valuetext",
        new Intl.NumberFormat("de", { style: "percent" }).format(0.5),
      );
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
      await expectAccessibleScreen(page, "Level");
    } finally {
      await browserContext.close();
    }
  });
});
