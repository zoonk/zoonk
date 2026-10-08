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

/** The Journey's number, with the plan's status under it. */
function journeyHero(page: Page) {
  return page.getByRole("button", { name: /^Your preparation/u });
}

/**
 * Opening Today after days away builds the day from a plan that moved forward first: what those
 * days left comes first, labeled as catching up, and the Journey says how much is left right away
 * instead of "On track". The plan changes while Today renders, where Next.js can't clear caches; the
 * plan's reads are private caches no server keeps, so the Journey reads it fresh anyway.
 */
test.describe("Plan after days away", () => {
  test("after days away, Today puts what they left first and the Journey says what's left to catch up", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      await Promise.all([
        prisma.planItem.updateMany({
          data: { scheduledFor: new Date(Date.now() - DAYS_AWAY * MS_PER_DAY) },
          where: { kind: "lesson", planId: plan.id, status: "todo" },
        }),
        prisma.studySession.deleteMany({ where: { goalId: user.goalId } }),
      ]);

      // Before Today moves it, the Journey reads every lesson left as overdue, and is cached so.
      await page.goto("/journey");
      await expect(journeyHero(page)).toContainText(/Needs adjusting|days? behind/u);

      await page.goto("/today");
      await expect(startDayButton(page)).toBeVisible();

      // Today says how far behind, and the lessons those days left are labeled as catching up.
      await expect(page.getByRole("main").getByText(/\d+ lessons? to catch up/u)).toBeVisible();

      const session = page.getByRole("region", { name: "Today's session" });
      await expect(session.getByText(/^Catching up/u).first()).toBeVisible();

      await expect
        .poll(() => prisma.planChange.count({ where: { kind: "missedDays", planId: plan.id } }))
        .toBe(1);

      await page.goto("/journey");
      await expect(journeyHero(page)).toContainText(/\d+ lessons? to catch up/u);
    });
  });
});
