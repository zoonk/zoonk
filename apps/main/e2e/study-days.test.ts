import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

/**
 * Which days the learner studies is theirs to choose in "Adjust your plan": one button a day, named
 * in full and pressed while it's a study day, so a screen reader says both.
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Sunday's minutes in the plan's week; null while every day keeps the daily time. */
async function loadSundayMinutes(goalId: string): Promise<unknown> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  const weekdayMinutes = isJsonObject(plan.settings) ? plan.settings.weekdayMinutes : null;

  return Array.isArray(weekdayMinutes) ? weekdayMinutes[0] : null;
}

test.describe("Study days", () => {
  test("names each day in full, says which ones she studies, and takes Sunday off", async ({
    browser,
  }) => {
    // Ana studies every day of the week.
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      await page.goto("/journey");
      await page.getByRole("button", { name: "Adjust plan" }).click();

      const days = page
        .getByRole("dialog", { name: "Adjust your plan" })
        .getByRole("group", { name: "Study days" });

      await expect(days.getByRole("button")).toHaveCount(WEEKDAYS.length);

      await Promise.all(
        WEEKDAYS.map((name) =>
          expect(days.getByRole("button", { exact: true, name, pressed: true })).toBeVisible(),
        ),
      );

      const sunday = days.getByRole("button", { exact: true, name: "Sunday" });
      await sunday.click();

      await expect(sunday).toHaveAttribute("aria-pressed", "false");
      await expect.poll(() => loadSundayMinutes(user.goalId)).toBe(0);
    });
  });
});
