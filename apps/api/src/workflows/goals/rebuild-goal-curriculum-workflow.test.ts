import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockHookConflict } from "../../../mocks/workflow";
import { rebuildGoalCurriculumWorkflow } from "./rebuild-goal-curriculum-workflow";

describe(rebuildGoalCurriculumWorkflow, () => {
  it("records terminal failure on its ask when the preceding rebuild wait expires", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ planRevealedAt: null, userId: user.id });
    await planFixture({ goalId: goal.id });

    const followUp = await prisma.followUp.create({
      data: {
        input: { goalId: goal.id },
        key: goal.id,
        kind: "rebuildGoalCurriculum",
        userId: user.id,
      },
    });

    mockHookConflict(
      { returnValue: Promise.resolve(null), runId: "another-owner" },
      { tokens: /^goal-rebuild:/u },
    );

    await expect(rebuildGoalCurriculumWorkflow({ followUp, goalId: goal.id })).rejects.toThrow(
      /still being rebuilt/u,
    );

    await expect(prisma.followUp.count({ where: { userId: user.id } })).resolves.toBe(1);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ buildFailedAt: expect.any(Date) });
  });
});
