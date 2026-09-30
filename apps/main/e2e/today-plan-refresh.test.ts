import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

const DAYS_AWAY = 3;

/** Focus's session card starts the day. */
function startDayButton(page: Page) {
  return page
    .getByRole("region", { name: "Today's session" })
    .getByRole("button", { name: /^Continue|^Start/u });
}

/**
 * Opening Today after days away builds the day from a plan that moved forward first, and the Plan
 * tab says so right away. The plan changes while Today renders, where Next.js can't clear caches;
 * the plan's reads are private caches no server keeps, so the Plan tab reads it fresh anyway.
 */
test.describe("Plan after days away", () => {
  test("after days away, Today moves the plan forward and the Plan tab shows it right away", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      // The Plan tab is cached before the learner comes back.
      await page.goto("/plan");

      await expect(page.getByRole("heading", { level: 1, name: /^Until /u })).toBeVisible();

      await Promise.all([
        prisma.planItem.updateMany({
          data: { scheduledFor: new Date(Date.now() - DAYS_AWAY * MS_PER_DAY) },
          where: { kind: "lesson", planId: plan.id, status: "todo" },
        }),
        prisma.studySession.deleteMany({ where: { goalId: user.goalId } }),
      ]);

      await page.goto("/today");
      await expect(startDayButton(page)).toBeVisible();

      await expect
        .poll(() => prisma.planChange.count({ where: { kind: "missedDays", planId: plan.id } }))
        .toBe(1);

      await page.goto("/plan");
      await expect(page.getByText(/days? away, the plan moved forward/u)).toBeVisible();
    });
  });
});
