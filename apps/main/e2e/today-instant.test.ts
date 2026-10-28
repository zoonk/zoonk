import { instant } from "@next/playwright";
import { expect, test } from "./fixtures";
import { createStudyDay, openAs } from "./study-day";

/**
 * Today is the screen learners open every day, and a tap on its tab must show their day at once:
 * every read it renders is a private cached read that rides in the tab's prefetch. Under
 * `instant()` nothing the server reads at tap time can arrive, so a read that drops out of the
 * prefetch (an uncached query, a request-time API in core) leaves Today's frame without the day.
 */
test.describe("Today's instant tab", () => {
  test("a tap on Today shows the learner's day from its prefetch", async ({ browser }) => {
    const { user } = await createStudyDay();
    const page = await openAs(browser, user);

    await page.goto("/plan");

    const today = page
      .getByRole("navigation", { name: "Learning tabs" })
      .getByRole("link", { name: /^Today\b/u });

    await expect(today).toBeVisible();

    await instant(page, async () => {
      await today.click();
      await expect(page.getByRole("button", { name: /^Start/u })).toBeVisible();
    });

    await expect(page).toHaveURL(/\/today$/u);
  });
});
