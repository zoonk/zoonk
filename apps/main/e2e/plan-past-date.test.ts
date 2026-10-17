import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { routeTimeToCover } from "./time-to-cover-routes";

const LEARN_KINDS = ["chapter", "lesson"] as const;

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

async function readTargetDate(goalId: string): Promise<string | null> {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return goal.targetDate?.toISOString().slice(0, 10) ?? null;
}

function countSetAside(goalId: string): Promise<number> {
  return prisma.planItem.count({
    where: { kind: { in: [...LEARN_KINDS] }, plan: { goalId }, status: "skipped" },
  });
}

/**
 * Lucas set himself a date and fell behind: it came three days ago, and the new day's settling set
 * aside the lessons it left (and dropped the challenges past it). Today has no session yet, so it
 * builds the day as it would the morning after.
 */
async function passTheDate(goalId: string) {
  const date = isoDaysFromNow(-3);

  await prisma.$transaction([
    prisma.goal.update({
      data: { targetDate: new Date(`${date}T00:00:00Z`) },
      where: { id: goalId },
    }),
    prisma.planItem.updateMany({
      data: { scheduledFor: new Date(`${isoDaysFromNow(-4)}T00:00:00Z`), status: "skipped" },
      where: { kind: { in: [...LEARN_KINDS] }, plan: { goalId }, status: "todo" },
    }),
    prisma.planItem.deleteMany({
      where: { kind: { notIn: [...LEARN_KINDS] }, plan: { goalId }, status: "todo" },
    }),
    prisma.studySession.deleteMany({ where: { goalId, status: { in: ["active", "planned"] } } }),
  ]);

  return { date, setAside: await countSetAside(goalId) };
}

/**
 * Main's E2E runs without the API: Preview finds the day his time covers what's left by (the date
 * search runs only when he asks), here two months out.
 */
async function routeFoundDate({
  date,
  goalId,
  page,
}: {
  date: string;
  goalId: string;
  page: Page;
}) {
  const fittingDate = isoDaysFromNow(60);

  await routeTimeToCover(page, {
    goalId,
    time: { fittingDate, measure: "goal", targetDate: date },
  });

  return fittingDate;
}

/** The Plan's one suggestion: the aside's panel from 72rem, the line in the page's column under it. */
function suggestionSlot(page: Page) {
  return page.locator('[data-slot="plan-suggestion"]').filter({ visible: true });
}

test.describe("A plan whose date came with lessons left", () => {
  // Lucas's plan read "Ended" and "Your plan ended · 13 lessons were left out" the day after his
  // date, and offered the course's next level over them. The owner: plans don't end; offer a way
  // to adjust them automatically.
  test("keeps going from the Plan once he previews it, its diff first, and undo brings it back", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const { date, setAside } = await passTheDate(user.goalId);
      const fittingDate = await routeFoundDate({ date, goalId: user.goalId, page });

      expect(setAside).toBeGreaterThan(0);

      await page.setViewportSize({ height: 900, width: 1440 });
      await page.goto("/plan");

      const slot = suggestionSlot(page);

      // Never "finished", and no next level over the lessons left.
      await expect(page.getByText("You finished your plan")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Continue at/u })).toHaveCount(0);

      // What the change does is said before he asks, and the new date is found once he taps
      // Preview, since the page searches nothing: then its diff, leading with the lessons back.
      await expect(slot.getByText("Move your date so your time covers what's left.")).toBeVisible();

      await expect(slot.locator('[data-slot="diff-lines"]')).toHaveCount(0);
      await slot.getByRole("button", { exact: true, name: "Preview" }).click();

      await expect(
        slot.locator('[data-slot="diff-lines"]').getByRole("listitem").first(),
      ).toHaveText(/Adds (?:about )?\d+ lessons?$/u);

      await slot.getByRole("button", { exact: true, name: "Apply" }).click();

      await expect(slot.getByText("Plan updated", { exact: true })).toBeVisible();
      await expect.poll(() => countSetAside(user.goalId)).toBe(0);
      await expect.poll(() => readTargetDate(user.goalId)).toBe(fittingDate);

      await slot.getByRole("button", { exact: true, name: "Undo" }).click();
      await expect.poll(() => readTargetDate(user.goalId)).toBe(date);
      await expect.poll(() => countSetAside(user.goalId)).toBe(setAside);

      // Undo gives the offer back with the plan: he read "Undone" with no way back to it until he
      // reloaded.
      await expect(slot.getByRole("button", { exact: true, name: "Preview" })).toBeVisible();
    });
  });

  test("Today says no rest day past the date, and leads to the Plan; a phone answers in its sheet", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const { date } = await passTheDate(user.goalId);
      await routeFoundDate({ date, goalId: user.goalId, page });

      await page.setViewportSize({ height: 844, width: 390 });
      await page.goto("/today");

      await expect(page.getByText("Enjoy your day off!")).toHaveCount(0);
      await expect(page.getByText("Rest day", { exact: true })).toHaveCount(0);

      // The week's days past his date have nothing planned until he moves it, and say so by the
      // date: they read "after your plan" while his plan still held 13 lessons.
      const week = page.locator('[data-slot="today-week"]');
      await expect(week).toContainText(/Tuesday: |Wednesday: |Sunday: /u);
      await expect(week).not.toContainText("after your plan");

      await page.getByRole("link", { name: "See your plan" }).filter({ visible: true }).click();
      await expect(page).toHaveURL(/\/plan$/u);

      // On a phone the slot is a line; its sheet holds Preview, then the diff and Apply.
      await suggestionSlot(page).getByRole("button", { exact: true, name: "View" }).click();
      const sheet = page.getByRole("dialog");

      await sheet.getByRole("button", { exact: true, name: "Preview" }).click();
      await expect(sheet.locator('[data-slot="diff-lines"]')).toBeVisible();
      await sheet.getByRole("button", { exact: true, name: "Apply" }).click();
      await expect.poll(() => countSetAside(user.goalId)).toBe(0);
    });
  });
});
