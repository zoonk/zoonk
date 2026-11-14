import { prisma } from "@zoonk/db";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { countSetAside, passTheDate } from "./past-date";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";

test.describe("After an exam's date, with lessons left", () => {
  test("Keep studying puts the lessons back on the plan", async ({ browser }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const { setAside } = await passTheDate(user.goalId);
      expect(setAside).toBeGreaterThan(0);

      await page.goto("/today");
      await expect(page.getByText("Keep studying them, or archive this goal?")).toBeVisible();

      const keepStudying = page.getByRole("button", { exact: true, name: "Keep studying" });
      await expectHydrated(keepStudying);
      await keepStudying.click();

      await expect(keepStudying).toBeHidden({ timeout: REPLAN_TIMEOUT_MS });
      expect(await countSetAside(user.goalId)).toBe(0);
    });
  });

  test("Archive goal asks first, then archives it", async ({ browser }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      await passTheDate(user.goalId);

      await page.goto("/today");
      const archive = page.getByRole("button", { exact: true, name: "Archive goal" });
      await expectHydrated(archive);
      await archive.click();

      const confirm = page.getByRole("alertdialog");
      await confirm.getByRole("button", { exact: true, name: "Archive" }).click();

      await expect
        .poll(async () => {
          const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return goal.status;
        })
        .toBe("archived");
    });
  });

  test("the Plan says it in a line that opens nothing, asks in its bottom bar, and Keep studying there puts the lessons back", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const { setAside } = await passTheDate(user.goalId);
      expect(setAside).toBeGreaterThan(0);

      await page.setViewportSize({ height: 844, width: 390 });
      await page.goto("/plan");

      // The line only says it: a sheet would cover the bar that answers it.
      const line = page
        .locator('[data-slot="suggestion-line"]')
        .filter({ hasText: "Your exam date has passed" });

      await expect(line).toContainText("Keep studying them, or archive this goal?");
      await expect(line.getByRole("button")).toHaveCount(0);

      const bar = page.locator('[data-slot="bottom-bar"]');
      await expect(bar.getByRole("button", { exact: true, name: "Archive goal" })).toBeVisible();

      const keepStudying = bar.getByRole("button", { exact: true, name: "Keep studying" });
      await expectHydrated(keepStudying);
      await keepStudying.click();

      await expect(keepStudying).toBeHidden({ timeout: REPLAN_TIMEOUT_MS });
      expect(await countSetAside(user.goalId)).toBe(0);
    });
  });
});
