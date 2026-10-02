import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { memoryInsightFixture } from "@zoonk/testing/fixtures/memory";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { z } from "zod";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

/**
 * A plan-change insight on Today whose gap is bigger than one lesson: memory sized it as a few
 * lessons, so the planner kept it as a proposal with its effect until the learner says yes.
 */

const MESSAGE =
  "Fractions keep tripping you up in percentage questions. A few short lessons on fractions first should help.";

const EFFECT = {
  endDateAfter: "2026-12-04",
  endDateBefore: "2026-12-01",
  lessonsAdded: 3,
  lessonsRemoved: 0,
};

const graphSchema = z.object({ skills: z.array(z.object({ skillId: z.string() })) });

async function loadGraphSkillIds(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  return graphSchema.parse(plan.graph).skills.map((skill) => skill.skillId);
}

/** Three prerequisites to add before the plan's first skill, proposed the way memory does it. */
async function proposeGap({ goalId, userId }: { goalId: string; userId: string }) {
  const [plan, [firstSkillId], skills] = await Promise.all([
    prisma.plan.findUniqueOrThrow({ where: { goalId } }),
    loadGraphSkillIds(goalId),
    Promise.all(
      ["What fractions are", "Equivalent fractions", "Fractions as percentages"].map((name) =>
        skillFixture({ name: `${name} ${crypto.randomUUID()}` }),
      ),
    ),
  ]);

  const change = await planChangeFixture({
    kind: "edited",
    payload: {
      effect: EFFECT,
      operations: [
        {
          kind: "addSkills",
          skills: skills.map((skill) => ({
            area: null,
            beforeSkillId: firstSkillId ?? null,
            lessons: 1,
            name: skill.name,
            skillId: skill.id,
          })),
        },
      ],
      source: "memory",
    },
    planId: plan.id,
    reason: MESSAGE,
    status: "proposed",
  });

  await memoryInsightFixture({
    goalId,
    kind: "planChange",
    message: MESSAGE,
    payload: {
      effect: EFFECT,
      lessonFocus: "Fractions",
      planChangeId: change.id,
      planChangeStatus: "proposed",
      skillId: skills.at(-1)?.id,
    },
    userId,
  });

  return { change, skillIds: skills.map((skill) => skill.id) };
}

function loadChangeStatus(changeId: string) {
  return prisma.planChange
    .findUniqueOrThrow({ where: { id: changeId } })
    .then((change) => change.status);
}

test.describe("Plan-change insight bigger than a lesson", () => {
  test("shows its effect and adds it once the learner says yes", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "exam" }, async ({ page, user }) => {
      const { change, skillIds } = await proposeGap({ goalId: user.goalId, userId: user.id });
      await page.goto("/today");

      const card = page.getByRole("complementary", { name: "From your recent answers" });
      await expect(card.getByText(MESSAGE)).toBeVisible();
      await expect(card.getByText(/^Adds 3 lessons\. Ends .+ instead of .+\.$/u)).toBeVisible();
      await expectAccessibleScreen(page, "Today");

      // Nothing changes before the learner's OK.
      await expect.poll(() => loadGraphSkillIds(user.goalId)).not.toContain(skillIds[0]);

      await card.getByRole("button", { name: "Add it" }).click();
      await expect(card.getByRole("status")).toHaveText("It's in your plan.");

      await expect.poll(() => loadChangeStatus(change.id)).toBe("applied");

      await expect
        .poll(() => loadGraphSkillIds(user.goalId))
        .toStrictEqual(expect.arrayContaining(skillIds));
    });
  });

  test("waits on the Route with the same effect until applied, as other proposals wait to be declined", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "fun", persona: "exam" }, async ({ page, user }) => {
      const { change, skillIds } = await proposeGap({ goalId: user.goalId, userId: user.id });
      await page.goto("/plan");

      const waiting = page.getByRole("listitem").filter({ hasText: "Waiting for your OK" });
      const gap = waiting.filter({ hasText: MESSAGE });
      await expect(gap.getByText(/^Adds 3 lessons\. Ends .+ instead of .+\.$/u)).toBeVisible();

      await gap.getByRole("button", { name: "Apply" }).click();
      await expect(waiting).toHaveCount(1);

      await expect.poll(() => loadChangeStatus(change.id)).toBe("applied");

      await expect
        .poll(() => loadGraphSkillIds(user.goalId))
        .toStrictEqual(expect.arrayContaining(skillIds));

      // The plan's own proposal waits too, until "Not now" declines it.
      await expect(waiting).toContainText("sábado");
      await waiting.getByRole("button", { name: "Not now" }).click();
      await expect(page.getByText("Waiting for your OK")).toBeHidden();

      // The declined proposal leaves the list, so focus moves to the plan's changes.
      await expect(page.getByRole("heading", { name: "Changes to your plan" })).toBeFocused();

      await expect
        .poll(() =>
          prisma.planChange.count({ where: { plan: { goalId: user.goalId }, status: "declined" } }),
        )
        .toBe(1);
    });
  });
});
