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
 * Opening Today after days away builds the day from a plan that moved forward first: what those
 * days left comes first, labeled as catching up, and the Plan says how much is left right away
 * instead of "Keeping pace". The plan changes while Today renders, where Next.js can't clear caches; the
 * plan's reads are private caches no server keeps, so the Plan reads it fresh anyway.
 */
test.describe("Plan after days away", () => {
  test("after days away, Today puts what they left first and the Journey says what's left to catch up", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const plan = await stayAway(user.goalId);

      // Before Today moves it, the Plan reads every lesson left as overdue, and is cached so.
      await page.goto("/plan");
      await expect(planNumbers(page)).toContainText(/Needs adjusting|days? behind/u);

      await page.goto("/today");
      await expect(startDayButton(page)).toBeVisible();

      // Today says how far behind, and the lessons those days left are labeled as catching up.
      await expect(page.getByRole("main").getByText(/\d+ lessons? to catch up/u)).toBeVisible();

      const session = page.getByRole("region", { name: "Today's session" });
      await expect(session.getByText(/^Catching up/u).first()).toBeVisible();

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

      // Today moves the plan forward first, so the Plan then says there's a little to catch up.
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
