import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { skillFixture, skillPrerequisiteFixture } from "@zoonk/testing/fixtures/skills";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { type Page, expect, test } from "./fixtures";
import { MODES, asPersona } from "./learn-personas";

/**
 * "Your level" in "Change your plan", in Focus and Fun: a lower level brings in the foundations the plan
 * left out, announced with an undo; a higher level offers test-outs and skips nothing.
 */

/** The skill Ana's plan starts from: the first skill of its graph. */
async function findFirstPlanSkillId(goalId: string): Promise<string> {
  const plan = await prisma.plan.findUniqueOrThrow({ select: { graph: true }, where: { goalId } });
  const skills = isJsonObject(plan.graph) ? plan.graph.skills : null;
  const first: unknown = Array.isArray(skills) ? skills[0] : null;

  return getString(first, "skillId") ?? "";
}

/**
 * A foundation the learner never learned, private to them so no other test sees it, that the
 * plan's first skill rests on.
 */
async function addMissingFoundation({ goalId, userId }: { goalId: string; userId: string }) {
  const [first, foundation] = await Promise.all([
    findFirstPlanSkillId(goalId),
    skillFixture({
      name: `Comparar números ${randomUUID().slice(0, 6)}`,
      ownerId: userId,
      visibility: "private",
    }),
  ]);

  await skillPrerequisiteFixture({ prerequisiteId: foundation.id, skillId: first });
  return foundation;
}

function levelSection(page: Page) {
  return page.getByRole("region", { name: "Your level" });
}

/** "Your level" sits in "Change your plan" with the plan's other reshaping controls. */
async function openLevel(page: Page) {
  await page.goto("/plan");
  await page.getByRole("button", { name: "Change your plan" }).click();
  await expect(levelSection(page)).toBeVisible();
}

for (const mode of MODES) {
  test.describe(`Your level on the plan in ${mode}`, () => {
    test("a lower level adds the foundations first, with an undo", async ({ browser }) => {
      await asPersona(browser, { mode, persona: "exam" }, async ({ page, user }) => {
        const foundation = await addMissingFoundation({ goalId: user.goalId, userId: user.id });
        await openLevel(page);

        await levelSection(page)
          .getByRole("button", { name: "Nothing, I'm just starting" })
          .click();

        await expect(
          levelSection(page).getByText(
            "The foundations you need now come first in your plan. You can undo it above.",
          ),
        ).toBeVisible();

        const change = page
          .getByRole("listitem")
          .filter({ hasText: `For your new level, these come first: ${foundation.name}.` });

        await expect(change).toBeVisible();

        await expect
          .poll(async () => {
            const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
            return isJsonObject(goal.details) ? goal.details.level : null;
          })
          .toBe("none");

        await change.getByRole("button", { name: "Undo" }).click();
        await expect(change.getByText("Undone")).toBeVisible();
      });
    });

    test("a higher level offers test-outs and skips nothing", async ({ browser }) => {
      await asPersona(browser, { mode, persona: "exam" }, async ({ page, user }) => {
        const testedOutBefore = await prisma.planItem.count({
          where: { plan: { goalId: user.goalId }, status: "testedOut" },
        });

        await openLevel(page);
        await levelSection(page).getByRole("button", { name: "I know it well" }).click();

        await expect(
          levelSection(page).getByText(
            "Know these already? A quick test skips them. Nothing is skipped until you pass.",
          ),
        ).toBeVisible();

        await expect(
          levelSection(page)
            .getByRole("link", { name: /^Test out of /u })
            .first(),
        ).toBeVisible();

        await expect(
          levelSection(page).getByRole("button", { name: "I know it well" }),
        ).toHaveAttribute("aria-pressed", "true");

        const testedOutAfter = await prisma.planItem.count({
          where: { plan: { goalId: user.goalId }, status: "testedOut" },
        });

        expect(testedOutAfter).toBe(testedOutBefore);
      });
    });
  });
}
