import { prisma } from "@zoonk/db";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

/**
 * When an exam's written tests are practiced is the learner's choice (every week by default, every
 * other week or only in the final weeks), in "Adjust your plan"; and where the bar was for their
 * target, the last cut-off with its source, shows on the exam page.
 */

/** Ana's ENEM two months away; her seeded plan has the redação as a written test, as ENEM's do. */
async function twoMonthsAway(goalId: string) {
  await prisma.goal.update({
    data: { targetDate: new Date(toUTCMidnight(new Date()).getTime() + 60 * MS_PER_DAY) },
    where: { id: goalId },
  });
}

async function loadCadence(goalId: string): Promise<unknown> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  return isJsonObject(plan.settings) ? (plan.settings.writtenCadence ?? "weekly") : null;
}

async function openEditor(page: Page) {
  await page.goto("/journey");
  await expect(page.locator('[data-slot="journey"]')).toBeVisible();
  await page.getByRole("button", { name: "Adjust plan" }).click();
  return page.getByRole("dialog", { name: "Adjust your plan" });
}

test.describe("Written practice cadence", () => {
  test("practices the redação every week by default, and only in the final weeks when she says so", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      await twoMonthsAway(user.goalId);
      const editor = await openEditor(page);
      const cadence = editor.getByRole("radiogroup");

      await expect(editor.getByText("When to practice Redação")).toBeVisible();
      await expect(cadence.getByRole("radio", { name: "Every week" })).toBeChecked();
      await expect(editor.getByText(/a little every week/u)).toBeVisible();

      await cadence.getByRole("radio", { name: "Only the final weeks" }).click();

      await expect(cadence.getByRole("radio", { name: "Only the final weeks" })).toBeChecked();
      await expect(editor.getByText(/concentrated in the final weeks/u)).toBeVisible();
      await expect.poll(() => loadCadence(user.goalId)).toBe("finalWeeks");

      // From the keyboard: the arrow moves the choice back to every other week.
      await expect(cadence.getByRole("radio", { name: "Only the final weeks" })).toBeEnabled();
      await cadence.getByRole("radio", { name: "Only the final weeks" }).focus();
      await page.keyboard.press("ArrowLeft");

      await expect.poll(() => loadCadence(user.goalId)).toBe("biweekly");
      await expect(editor.getByText(/alternate weeks/u)).toBeVisible();
    });
  });

  test("shows where the bar was for her course, with its source, on the exam page", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const seeded = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
      const details = isJsonObject(seeded.details) ? seeded.details : {};

      const goal = await prisma.goal.update({
        data: {
          details: {
            ...details,
            institution: "UFMG",
            targetCourse: "Medicina",
            targetScore: "750",
          },
        },
        where: { id: user.goalId },
      });

      // Shared by every copy of Ana, who all aim at the same course: one row a year.
      await prisma.targetCutoff.createMany({
        data: {
          edition: "Sisu 2025",
          examBlueprintId: goal.examBlueprintId ?? "",
          model: "test",
          promptVersion: "test",
          quota: "ampla concorrência",
          runId: "test",
          score: 790.8,
          sourceTitle: "Notas de corte",
          sourceUrl: "https://sisu.mec.gov.br/notas-de-corte",
          status: "found",
          targetKey: "course:medicina|ufmg",
          year: new Date().getUTCFullYear(),
        },
        skipDuplicates: true,
      });

      await page.goto("/exam");
      const note = page.getByRole("note", { name: "Last cut-off" });

      await expect(note).toContainText("Last cut-off: 790.8");

      await expect(note).toContainText(
        "Medicina · UFMG · Sisu 2025 · ampla concorrência, according to sisu.mec.gov.br",
      );

      await expect(note).toContainText("Your goal: 750");

      await expect(note.getByRole("link", { name: "sisu.mec.gov.br" })).toHaveAttribute(
        "href",
        "https://sisu.mec.gov.br/notas-de-corte",
      );
    });
  });
});
