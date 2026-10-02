import { getDailySpendBudgetMicros } from "@zoonk/core/entitlements/limits";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { expect, test } from "./fixtures";
import { expectMode } from "./learn-personas";
import { createStudyDay, openAs } from "./study-day";

/**
 * A plan edit in plain words once today's small AI help is used up, with real limits: the plan's
 * Server Action claims the help in core. A guest's limit is core's to test, and the notice's copy
 * for guests and for spoken answers is the player's (`packages/player`).
 */
test.describe("Today's AI help used up", () => {
  test("a plan edit in plain words tells a free learner how to keep going", async ({ browser }) => {
    const { user } = await createStudyDay({ mode: "focus" });

    // One use that spent the free learner's whole daily AI budget.
    await usageRecordsFixture({
      costMicros: getDailySpendBudgetMicros("free"),
      count: 1,
      createdAt: new Date(),
      kind: "assist",
      userId: user.id,
    });

    const page = await openAs(browser, user);

    try {
      await page.goto("/plan");
      await expectMode(page, "focus");

      await page.getByRole("button", { name: "Change your plan" }).click();
      await page.getByLabel("Change it in your own words").fill("Less on weekends");
      await page.getByRole("button", { name: "Change my plan" }).click();

      await expect(
        page.getByText(
          "You've used today's help. It comes back tomorrow, or get Plus to keep going now.",
        ),
      ).toBeVisible();

      await expect(page.getByRole("link", { name: "See Plus" })).toBeVisible();
      await expect(page.getByText("That didn't work", { exact: false })).toBeHidden();

      // What they wrote stays, to send once the help is back.
      await expect(page.getByLabel("Change it in your own words")).toHaveValue("Less on weekends");
    } finally {
      await page.context().close();
    }
  });
});
