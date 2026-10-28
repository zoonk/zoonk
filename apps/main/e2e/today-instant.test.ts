import { instant } from "@next/playwright";
import { expect, test } from "./fixtures";
import { expectHydrated } from "./hydration";
import { createStudyDay, openAs } from "./study-day";

/**
 * Under `instant()` nothing the server reads at tap time arrives, so a read that drops out of the
 * tab's prefetch leaves Today without the day.
 */
test.describe("Today's instant tab", () => {
  test("a tap on Today shows the learner's day from its prefetch", async ({ browser }) => {
    const { user } = await createStudyDay();
    const page = await openAs(browser, user);

    await page.goto("/plan");

    const today = page
      .getByRole("navigation", { name: "Learning tabs" })
      .getByRole("link", { name: /^Today\b/u });

    // A tap before hydration would load the page as a document, which the lock stops at its shell.
    await expectHydrated(today);

    await instant(page, async () => {
      await today.click();
      await expect(page.getByRole("button", { name: /^Start/u })).toBeVisible();
    });

    await expect(page).toHaveURL(/\/today$/u);
  });
});
