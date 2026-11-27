import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { learnerGoalFixture } from "../../../learner/_test-utils/learner-goal";
import { applyCourseStart } from "../../../learner/placement/_utils/course-start-items";

describe("R50 provisional course starts", () => {
  it("skips only this plan's lessons whose every skill qualifies", async () => {
    const user = await userFixture();

    const { goal, planItems, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [3],
      userId: user.id,
    });

    const [first, second, last] = skills;
    const mixed = planItems[1]?.lessonId;

    if (!first || !second || !last || !mixed) {
      throw new Error("Expected three distinct lesson skills");
    }

    await lessonSkillFixture({ lessonId: mixed, skillId: last.id });
    const sibling = await goalFixture({ userId: user.id });

    const other = await planFixture({
      goalId: sibling.id,
      items: [{ lessonId: planItems[0]?.lessonId, skillId: first.id }],
    });

    const decision = () =>
      prisma.$transaction((tx) =>
        applyCourseStart({
          goalId: goal.id,
          now: new Date(),
          startedPastSkillIds: [first.id, second.id],
          tx,
        }),
      );

    await expect(decision()).resolves.toMatchObject({ testedOutPlanItemIds: [planItems[0]?.id] });
    await expect(decision()).resolves.toMatchObject({ testedOutPlanItemIds: [] });

    await expect(
      prisma.planItem.count({ where: { planId: other.id, status: "testedOut" } }),
    ).resolves.toBe(0);

    await expect(prisma.learnerSkill.count({ where: { userId: user.id } })).resolves.toBe(0);
  });
});
