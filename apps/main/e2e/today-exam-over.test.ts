import { prisma } from "@zoonk/db";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { countSetAside, passTheDate } from "./past-date";

test.describe("Today after an exam's date, with lessons left", () => {
  test("Keep studying puts the lessons back on the plan", async ({ browser }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const { setAside } = await passTheDate(user.goalId);
      expect(setAside).toBeGreaterThan(0);

      await page.goto("/today");
      await expect(page.getByText("Keep studying them, or archive this goal?")).toBeVisible();

      const keepStudying = page.getByRole("button", { exact: true, name: "Keep studying" });
      await expectHydrated(keepStudying);
      await keepStudying.click();

      await expect.poll(() => countSetAside(user.goalId)).toBe(0);
      await expect(keepStudying).toBeHidden();
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
});
