import { prisma } from "@zoonk/db";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";

/**
 * The Plan's "Adjust plan" changes the plan as the learner says, and Undo gives it back as it was.
 */

/** A preset's time as the editor writes it: "45 min", "1 hr", "1 hr 30 min". */
function minutesLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) {
    return `${rest} min`;
  }

  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

async function openJourney(page: Page) {
  await page.goto("/plan");
  await expect(page.locator('[data-slot="journey"]')).toBeVisible();
}

test.describe("Journey", () => {
  test("says what a time change in the plan editor did, and Undo gives the plan back as it was", async ({
    browser,
  }) => {
    // Lucas's small plan plans again in a moment after each change.
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      // Each item by what it is, its day and its status: what the learner sees of the plan.
      const loadPlanItems = async () => {
        const items = await prisma.planItem.findMany({
          select: { kind: true, lessonId: true, scheduledFor: true, skillId: true, status: true },
          where: { plan: { goalId: user.goalId } },
        });

        return items
          .map(
            (item) =>
              `${item.kind}:${item.lessonId ?? item.skillId}:${item.scheduledFor?.toISOString() ?? "-"}:${item.status}`,
          )
          .toSorted();
      };

      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
      const own = new RegExp(`^${minutesLabel(goal.dailyMinutes)}(?:\\s|$)`, "u");
      const otherTime = goal.dailyMinutes === 15 ? "30 min" : "15 min";

      await openJourney(page);
      await page.getByRole("button", { name: "Adjust plan" }).click();
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      const minutes = editor.getByRole("radiogroup", { name: "Time a day" });
      const before = await loadPlanItems();

      await minutes.getByText(otherTime, { exact: true }).click();

      // The editor says what the change did, by its controls, with a way back, once the plan is
      // made again.
      await expect(
        editor.getByRole("status").filter({ hasText: `Daily time changed to ${otherTime}.` }),
      ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

      // The plan was made again for the new time, so Undo has something to give back.
      await expect.poll(loadPlanItems).not.toStrictEqual(before);
      await editor.getByRole("button", { name: "Undo" }).click();

      await expect(
        editor.getByRole("status").filter({ hasText: "Undone. Your plan is back as it was." }),
      ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

      await expect(minutes.getByRole("radio", { name: own })).toBeChecked();
      await expect(editor.getByRole("button", { name: "Undo" })).toHaveCount(0);
      await expect.poll(loadPlanItems).toStrictEqual(before);

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } }),
      ).resolves.toMatchObject({ dailyMinutes: goal.dailyMinutes });
    });
  });
});
