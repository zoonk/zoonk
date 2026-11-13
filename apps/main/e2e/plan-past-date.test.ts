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
      const preview = slot.getByRole("button", { exact: true, name: "Preview" });
      await expectHydrated(preview);
      await preview.click();
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
