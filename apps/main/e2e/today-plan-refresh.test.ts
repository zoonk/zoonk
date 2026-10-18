import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

const DAYS_AWAY = 3;

/** The session card starts the day. */
function startDayButton(page: Page) {
  return page
    .getByRole("region", { name: "Today's session" })
    .getByRole("button", { name: /^Continue|^Start/u });
}

/** The Plan's two numbers, the pace with the plan's status under it, as the aside draws them. */
function planNumbers(page: Page) {
  return page.locator('[data-slot="journey-standing"]').filter({ visible: true });
}

/** The learner was away: the lessons left fell days ago, and no day was started since. */
async function stayAway(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });

  await Promise.all([
    prisma.planItem.updateMany({
      data: { scheduledFor: new Date(Date.now() - DAYS_AWAY * MS_PER_DAY) },
      where: { kind: "lesson", planId: plan.id, status: "todo" },
    }),
    prisma.studySession.deleteMany({ where: { goalId } }),
  ]);

  return plan;
}

/**
 * After days away, both reads show the selected plan in memory. Only the learner's Start POST
 * persists the moved-forward plan and its mandatory change notice.
 */
test.describe("Plan after days away", () => {
  test("after days away, Today puts what they left first and the Journey says what's left to catch up", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const plan = await stayAway(user.goalId);

      // No GET settles the plan in storage; Plan already shows the actual selected backlog.
      await page.goto("/plan");
      await expect(planNumbers(page)).toContainText(/\d+ lessons? to catch up/u);

      await page.goto("/today");
      await expect(startDayButton(page)).toBeVisible();

      // Today says how far behind, and the lessons those days left are labeled as catching up.
      await expect(page.getByRole("main").getByText(/\d+ lessons? to catch up/u)).toBeVisible();

      const session = page.getByRole("region", { name: "Today's session" });
      await expect(session.getByText(/^Catching up/u).first()).toBeVisible();

      // GETs remain read-only. The same real Start persists the plan that both reads showed.
      await expect(
        prisma.planChange.count({ where: { kind: "missedDays", planId: plan.id } }),
      ).resolves.toBe(0);

      await startDayButton(page).click();
      await expect(page).toHaveURL(/\/session(?:[/?]|$)/u);

      await expect
        .poll(() => prisma.planChange.count({ where: { kind: "missedDays", planId: plan.id } }))
        .toBe(1);

      await page.goto("/plan");
      await expect(planNumbers(page)).toContainText(/\d+ lessons? to catch up/u);
    });
  });

  test("on a phone, the Plan's catch-up suggestion takes the learner to Today", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      await stayAway(user.goalId);
      await page.setViewportSize({ height: 844, width: 390 });

      // Today and Plan project the moved-forward work without persisting it on either GET.
      await page.goto("/today");
      await expect(startDayButton(page)).toBeVisible();

      await page.goto("/plan");

      await page
        .getByRole("region", { name: "A little to catch up" })
        .getByRole("button", { name: "View" })
        .click();

      await page
        .getByRole("dialog", { name: "A little to catch up" })
        .getByRole("link", { name: "Go to Today" })
        .click();

      await expect(page).toHaveURL(/\/today$/u);
      await expect(startDayButton(page)).toBeVisible();
    });
  });
});
