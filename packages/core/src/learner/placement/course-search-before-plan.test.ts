import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { loadPlanContext } from "../../plans/_utils/plan-context";
import { writePlan } from "../../plans/_utils/write-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { coursePlacementSitting } from "../_test-utils/course-placement-sitting";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { finishGoalPlacement } from "./finish-goal-placement";

describe("a course start before lessons are laid out", () => {
  it("applies the saved decision to new lessons and restores their materialized layout on Undo", async () => {
    const user = await userFixture();

    const { goal, plan, planItems, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [4],
      userId: user.id,
    });

    mockSession(user.id);
    await prisma.planItem.deleteMany({ where: { planId: plan.id } });

    const sitting = await coursePlacementSitting(
      goal.id,
      skills.map((skill) => skill.id),
    );

    await sitting.answerAll();

    const result = await finishGoalPlacement({
      goalId: goal.id,
      input: { attemptId: sitting.attemptId },
    });

    if (result.status !== "ready" || !result.completion.changeId) {
      throw new Error("Expected a saved provisional start");
    }

    expect(result.completion.result).toMatchObject({
      chapter: "Phase 1",
      course: null,
      nextLesson: null,
    });

    const context = await loadPlanContext({ goal });

    if (!context) {
      throw new Error("Expected a plan");
    }

    await prisma.$transaction((tx) =>
      writePlan({
        context,
        plan: {
          coveredShare: null,
          estimateHours: null,
          inputsKey: null,
          items: planItems.map((item) => ({ ...item, id: null })),
          phases: context.phases,
          sourceSkillIds: [],
          standInLessons: new Map(),
          state: context.state,
        },
        tx,
      }),
    );

    const statuses = () =>
      prisma.planItem.findMany({
        orderBy: { position: "asc" },
        select: { skillId: true, status: true },
        where: { planId: plan.id },
      });

    const applied = await statuses();

    expect(applied.map((item) => item.status)).toStrictEqual([
      "testedOut",
      "testedOut",
      "testedOut",
      "todo",
    ]);

    const undo = await decidePlanChange({
      changeId: result.completion.changeId,
      goalId: goal.id,
      input: { status: "undone" },
    });

    expect(undo.status).toBe("updated");

    await expect(statuses()).resolves.toStrictEqual(
      skills.map((skill) => ({ skillId: skill.id, status: "todo" })),
    );
  });
});
