import { getDailySpendBudgetMicros } from "@zoonk/core/entitlements/limits";
import { prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { type Page, expect, test } from "./fixtures";
import { expectMode } from "./learn-personas";
import { createStudyDay, openAs } from "./study-day";

/**
 * A plan edit in plain words once today's small AI help is used up, with real limits: the plan's
 * Server Action claims the help in core. Spoken answers show the same notice from the API's
 * answer (`spoken-answer-microphone.test.ts`).
 */

type Tier = "free" | "guest";

/** A guest's small AI help for a day (`assist` in core's limits). */
const GUEST_DAILY_HELP = 40;

const NOTICES: Record<Tier, { link: string; text: string }> = {
  free: {
    link: "See Plus",
    text: "You've used today's help. It comes back tomorrow, or get Plus to keep going now.",
  },
  guest: {
    link: "Create a free account",
    text: "You've used today's free help. Create a free account to keep going.",
  },
};

/**
 * Spends the learner's small AI help for today: a guest's daily count, or a free learner's daily
 * AI budget. A guest's session cookie still caches "signed up", so the page drops it.
 */
async function useUpTodaysHelp({ page, tier, userId }: { page: Page; tier: Tier; userId: string }) {
  if (tier === "free") {
    await usageRecordsFixture({
      // One use that spent the free learner's whole daily AI budget.
      costMicros: getDailySpendBudgetMicros("free"),
      count: 1,
      createdAt: new Date(),
      kind: "assist",
      userId,
    });

    return;
  }

  await Promise.all([
    prisma.user.update({ data: { isAnonymous: true }, where: { id: userId } }),
    usageRecordsFixture({ count: GUEST_DAILY_HELP, createdAt: new Date(), kind: "assist", userId }),
  ]);

  await page.context().clearCookies({ name: /session_data/u });
}

test.describe("Today's AI help used up", () => {
  for (const tier of ["guest", "free"] as const) {
    test(`a plan edit in plain words tells a ${tier} learner how to keep going`, async ({
      browser,
    }) => {
      const { user } = await createStudyDay({ mode: "focus" });
      const page = await openAs(browser, user);

      try {
        await useUpTodaysHelp({ page, tier, userId: user.id });
        await page.goto("/plan");
        await expectMode(page, "focus");

        await page.getByRole("button", { name: "Change your plan" }).click();
        await page.getByLabel("Change it in your own words").fill("Less on weekends");
        await page.getByRole("button", { name: "Change my plan" }).click();

        await expect(page.getByText(NOTICES[tier].text)).toBeVisible();
        await expect(page.getByRole("link", { name: NOTICES[tier].link })).toBeVisible();
        await expect(page.getByText("That didn't work", { exact: false })).toBeHidden();

        // What they wrote stays, to send once the help is back.
        const words = page.getByLabel("Change it in your own words");
        await expect(words).toHaveValue("Less on weekends");
      } finally {
        await page.context().close();
      }
    });
  }
});
