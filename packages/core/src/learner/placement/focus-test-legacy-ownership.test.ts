import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { isJsonObject } from "@zoonk/utils/json";
import { describe, expect, it } from "vitest";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { proposePlanChange } from "../../plans/propose-plan-change";
import { PLAN_SHOWN, shortPlanExamGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { answerPlacementQuestion } from "./answer-placement-question";
import { readFocusTestRecord } from "./focus-test-state";

async function legacyGoalFixture() {
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

  return { areas, goal, plan };
}

describe("a legacy Focus test's ownership", () => {
  it("derives ownership on the first sitting after an unrelated change and Undo", async () => {
    const { goal, plan, areas } = await legacyGoalFixture();

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

  it.each([
    { editFocus: false, oldSnapshot: false },
    { editFocus: true, oldSnapshot: false },
    { editFocus: false, oldSnapshot: true },
    { editFocus: true, oldSnapshot: true },
  ])(
    "restores legacy ownership after a first test write: %j",
    async ({ editFocus, oldSnapshot }) => {
      const { goal, plan, areas } = await legacyGoalFixture();

      const edited = await changeGoalPlan({
        goalId: goal.id,
        input: {
          operations: editFocus
            ? [{ areas: ["Ética"], kind: "focusAreas" }]
            : [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [1] }],
        },
        trackAnalytics: false,
      });

      if (edited?.status !== "applied" || !edited.change) {
        throw new Error(`Expected an applied change, received ${edited?.status}`);
      }

      const snapshot = await prisma.planChangeSnapshot.findUniqueOrThrow({
        where: { changeId: edited.change.id },
      });

      if (oldSnapshot && isJsonObject(snapshot.plan)) {
        const { testFocus: _testFocus, ...oldPlan } = snapshot.plan;

        await prisma.planChangeSnapshot.update({
          data: { plan: oldPlan },
          where: { changeId: edited.change.id },
        });
      }

      const placement = await startSitting(goal.id);

      if (!editFocus) {
        if (!placement.next) {
          throw new Error("Expected a test question");
        }

        const answered = await answerPlacementQuestion({
          goalId: goal.id,
          input: { answer: { dontKnow: true }, durationMs: 20_000, itemId: placement.next.itemId },
        });

        if (answered.status !== "ready") {
          throw new Error(`Expected a saved answer, received ${answered.status}`);
        }
      }

      const started = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      expect(readFocusTestRecord(started)?.focus).toStrictEqual(editFocus ? null : areas);

      await expect(
        decidePlanChange({
          changeId: edited.change.id,
          goalId: goal.id,
          input: { status: "undone" },
        }),
      ).resolves.toMatchObject({ status: "updated" });

      const undone = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      const restored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
      expect(readFocusTestRecord(undone)?.focus).toStrictEqual(areas);
      expect(parsePlanSettings(restored.settings).focusAreas).toStrictEqual(areas);

      await expect(
        proposePlanChange({
          approval: "always",
          goalId: goal.id,
          operations: [{ areas: ["Informática", "Raciocínio"], kind: "focusAreas" }],
          reason: "",
          source: "focusTest",
        }),
      ).resolves.toMatchObject({ status: "proposed" });

      expect(snapshot.plan).not.toHaveProperty("testFocus");
    },
  );
});
