import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { describe, expect, it } from "vitest";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { PLAN_SHOWN, shortPlanExamGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { readFocusTestRecord } from "./focus-test-state";

describe("a legacy Focus test's ownership", () => {
  it("derives ownership on the first sitting after an unrelated change and Undo", async () => {
    const { goal, plan, user } = await shortPlanExamGoalFixture({
      goal: { ...PLAN_SHOWN, timezone: "UTC" },
    });

    await prisma.goal.update({ data: { details: PLAN_SHOWN.details }, where: { id: goal.id } });
    const areas = ["Direito"];

    const original = await planChangeFixture({
      payload: { operations: [{ areas, kind: "focusAreas" }], source: "learner" },
      planId: plan.id,
      status: "applied",
    });

    await learningEventFixture({
      contentIds: {
        focusTestScore: JSON.stringify({ focusAreas: areas }),
        planChangeId: original.id,
      },
      goalId: goal.id,
      lessonKind: "focusTest",
      userId: user.id,
    });

    await prisma.plan.update({
      data: { settings: { ...parsePlanSettings(plan.settings), focusAreas: areas } },
      where: { id: plan.id },
    });

    const edited = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [1] }] },
      trackAnalytics: false,
    });

    if (edited?.status !== "applied" || !edited.change) {
      throw new Error(`Expected an applied change, received ${edited?.status}`);
    }

    await expect(
      decidePlanChange({
        changeId: edited.change.id,
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    const undone = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    await startSitting(goal.id);
    const started = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    const restored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(readFocusTestRecord(started)?.focus).toStrictEqual(areas);
    expect(parsePlanSettings(restored.settings).focusAreas).toStrictEqual(areas);
    expect(readFocusTestRecord(undone)).toBeNull();
  });
});
