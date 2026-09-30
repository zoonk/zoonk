import { prisma } from "@zoonk/db";
import { stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { expect, test } from "./fixtures";
import { MODES, asPersona } from "./learn-personas";

const DEEPER_TEXT =
  "The electron is described by a **wave function**; its squared magnitude gives the probability density.";

/**
 * "Go deeper" by default, for learners who asked for a more technical register: a switch in
 * Appearance (on by itself when memory noticed it, and saying so), and explanations that open their
 * deeper version first, with one tap back to the original. Both modes.
 */
test.describe("Go deeper by default", () => {
  for (const mode of MODES) {
    test(`turns it on in Appearance and keeps it in ${mode}`, async ({ browser }) => {
      await asPersona(browser, { mode, persona: "hugeGoal" }, async ({ page, user }) => {
        await page.goto("/settings/appearance");

        const setting = page.getByRole("switch", { name: "Go deeper by default" });
        await expect(setting).not.toBeChecked();
        await setting.click();
        await expect(setting).toBeChecked();

        await expect
          .poll(async () => {
            const profile = await prisma.userLearningProfile.findUnique({
              where: { userId: user.id },
            });

            return profile?.deeperByDefault;
          })
          .toBe(true);

        await page.reload();
        await expect(page.getByRole("switch", { name: "Go deeper by default" })).toBeChecked();
      });
    });

    test(`opens an explanation's deeper version first in ${mode}`, async ({ browser }) => {
      await asPersona(browser, { mode, persona: "hugeGoal" }, async ({ page, user }) => {
        const { lesson, steps } = await playableLessonFixture({ steps: ["explanation", "check"] });
        const [explanation] = steps;

        if (!explanation) {
          throw new Error("The lesson has no explanation");
        }

        await Promise.all([
          stepVariantFixture({
            content: { text: DEEPER_TEXT, title: "The wave function" },
            kind: "deeper",
            stepId: explanation.id,
          }),
          prisma.userLearningProfile.update({
            data: { deeperByDefault: true },
            where: { userId: user.id },
          }),
        ]);

        await page.goto(`/learn/${lesson.id}`);

        await expect(page.getByText("Deeper version")).toBeVisible();
        await expect(page.getByText("The wave function")).toBeVisible();
        await expect(page.getByText("A cloud, not a little ball")).toHaveCount(0);

        await page.getByRole("button", { name: "Show the original" }).click();
        await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
        await expect(page.getByText("Deeper version")).toHaveCount(0);

        await page.getByRole("button", { name: "Go deeper" }).click();
        await expect(page.getByText("The wave function")).toBeVisible();
      });
    });
  }

  test("says when memory turned it on, and a choice replaces it", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "hugeGoal" }, async ({ page, user }) => {
      await prisma.userLearningProfile.update({
        data: { memoryAsksDeeper: true },
        where: { userId: user.id },
      });

      await page.goto("/settings/appearance");

      const setting = page.getByRole("switch", { name: "Go deeper by default" });
      await expect(setting).toBeChecked();

      await expect(
        page.getByText("On because you asked for more technical explanations"),
      ).toBeVisible();

      await setting.click();
      await expect(setting).not.toBeChecked();

      await expect(
        page.getByText("Explanations open their more technical version first"),
      ).toBeVisible();
    });
  });
});
