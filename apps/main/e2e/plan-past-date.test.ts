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

  await routeTimeToCover(page, { goalId, time: { fittingDate, targetDate: date } });

  return fittingDate;
}

function suggestionSlot(page: Page) {
  return page.locator('[data-slot="plan-suggestion"]').filter({ visible: true });
}

test.describe("A plan whose date came with lessons left", () => {
  test("keeps going from the Plan once he previews it, and undo brings it back", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const { date, setAside } = await passTheDate(user.goalId);
      const fittingDate = await routeFoundDate({ date, goalId: user.goalId, page });

      expect(setAside).toBeGreaterThan(0);

      await page.setViewportSize({ height: 900, width: 1440 });
      await page.goto("/plan");

      const slot = suggestionSlot(page);
      await slot.getByRole("button", { exact: true, name: "Preview" }).click();
      await expect(slot.locator('[data-slot="diff-lines"]')).toBeVisible();
      await slot.getByRole("button", { exact: true, name: "Apply" }).click();

      await expect(slot.getByText("Plan updated", { exact: true })).toBeVisible();
      await expect.poll(() => countSetAside(user.goalId)).toBe(0);
      await expect.poll(() => readTargetDate(user.goalId)).toBe(fittingDate);

      await slot.getByRole("button", { exact: true, name: "Undo" }).click();
      await expect.poll(() => readTargetDate(user.goalId)).toBe(date);
      await expect.poll(() => countSetAside(user.goalId)).toBe(setAside);

      await expect(slot.getByRole("button", { exact: true, name: "Preview" })).toBeVisible();
    });
  });
});
