import { type Page } from "@playwright/test";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { countSetAside, isoDaysFromNow, passTheDate, readTargetDate } from "./past-date";
import { routeTimeToCover } from "./time-to-cover-routes";

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
  test("moves the date from the Plan once the learner checks it, and undo brings it back", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const { date, setAside } = await passTheDate(user.goalId);
      const fittingDate = await routeFoundDate({ date, goalId: user.goalId, page });

      expect(setAside).toBeGreaterThan(0);

      await page.setViewportSize({ height: 900, width: 1440 });
      await page.goto("/plan");

      const slot = suggestionSlot(page);
      const findDate = slot.getByRole("button", { exact: true, name: "Find a date" });
      await expectHydrated(findDate);
      await findDate.click();
      await slot.getByRole("button", { exact: true, name: "Change my plan" }).click();

      await expect(slot.getByText("Plan updated", { exact: true })).toBeVisible();
      await expect.poll(() => countSetAside(user.goalId)).toBe(0);
      await expect.poll(() => readTargetDate(user.goalId)).toBe(fittingDate);

      await slot.getByRole("button", { exact: true, name: "Undo" }).click();
      await expect.poll(() => readTargetDate(user.goalId)).toBe(date);
      await expect.poll(() => countSetAside(user.goalId)).toBe(setAside);

      await expect(slot.getByRole("button", { exact: true, name: "Find a date" })).toBeVisible();
    });
  });
});
