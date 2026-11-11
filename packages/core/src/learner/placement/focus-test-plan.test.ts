import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { describe, expect, it } from "vitest";
import { settleNewPlan } from "../../plans/_utils/recommended-bases";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { getPlanTimeAdvice } from "../../plans/get-time-advice";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { PLAN_SHOWN, shortPlanExamGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { readFocusTestRecord } from "./focus-test-state";

const DONT_KNOW = { dontKnow: true } as const;
const RIGHT = { selectedIndex: 0 };

const MISS_FOURTH = [RIGHT, RIGHT, RIGHT, DONT_KNOW];

/** Answers a sitting's first questions, one subject each in the notice's order, and finishes it. */
async function sit(goalId: string, answers: readonly (typeof DONT_KNOW | typeof RIGHT)[]) {
  let placement = await startSitting(goalId);

  for (const answer of answers) {
    // oxlint-disable-next-line no-await-in-loop -- Each answer decides the next question.
    const result = await answerPlacementQuestion({
      goalId,
      input: { answer, durationMs: 20_000, itemId: placement.next?.itemId ?? "" },
    });

    if (result.status !== "ready") {
      throw new Error(`The answer wasn't taken: ${result.status}`);
    }

    placement = result.placement;
  }

  const result = await finishGoalPlacement({ goalId, input: {} });

  if (result.status !== "ready") {
    throw new Error(`Placement didn't finish: ${result.status}`);
  }

  return result.completion;
}

function readDetails(details: unknown): Record<string, unknown> {
  return isJsonObject(details) ? details : {};
}

async function readFocus(goalId: string) {
  const [goal, plan] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: goalId } }),
    prisma.plan.findUniqueOrThrow({ where: { goalId } }),
  ]);

  return {
    covered: plan.coveredShare,
    planFocus: parsePlanSettings(plan.settings).focusAreas,
    testFocus: readFocusTestRecord(goal)?.focus ?? null,
  };
}

describe("the Focus test on a plan whose time is short", () => {
  it("sets its suggested focus when the daily time is saved, and says so on the time question", async () => {
    const { goal } = await shortPlanExamGoalFixture();
    const completion = await sit(goal.id, MISS_FOURTH);

    expect(completion.focusTest?.checkpoint?.focus).toMatchObject({
      rows: [
        { areas: ["Raciocínio"], reason: "answers" },
        { areas: ["Atualidades"], reason: "notAsked" },
      ],
      state: "ifTimeShort",
    });

    await expect(readFocus(goal.id)).resolves.toMatchObject({ planFocus: [], testFocus: null });

    await expect(getPlanTimeAdvice({ goalId: goal.id, input: {} })).resolves.toMatchObject({
      advice: {
        focusSubjects: [
          { name: "Raciocínio", shortName: null },
          { name: "Atualidades", shortName: null },
        ],
      },
    });

    const { details } = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    await prisma.goal.update({
      data: { details: { ...readDetails(details), answered: PLAN_SHOWN.details.answered } },
      where: { id: goal.id },
    });

    await settleNewPlan({ goalId: goal.id });

    await expect(readFocus(goal.id)).resolves.toMatchObject({
      planFocus: ["Raciocínio", "Atualidades"],
      testFocus: ["Raciocínio", "Atualidades"],
    });

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: { focusTest: { setsFocus: true, state: "checked", subjects: { asked: 4, total: 6 } } },
    });
  });

  it("leaves a learner who skipped the test with no focus", async () => {
    const { goal } = await shortPlanExamGoalFixture();

    await finishGoalPlacement({ goalId: goal.id, input: {} });
    await settleNewPlan({ goalId: goal.id });

    await expect(readFocus(goal.id)).resolves.toMatchObject({ planFocus: [], testFocus: null });

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: {
        focusTest: {
          offer: { minutes: 15, questions: 15 },
          sessionQuestions: "off",
          setsFocus: false,
          state: "notStarted",
          subjects: null,
        },
      },
    });
  });

  it("proposes its focus on a plan the learner has seen, once, and keeps it when applied", async () => {
    const { goal, plan } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });
    const completion = await sit(goal.id, [DONT_KNOW]);
    const focus = completion.focusTest?.checkpoint?.focus;

    expect(focus).toMatchObject({
      proposal: {
        operations: [{ areas: ["Direito", "Português"], kind: "focusAreas" }],
        source: "focusTest",
        status: "proposed",
      },
      state: "proposed",
    });

    await finishGoalPlacement({ goalId: goal.id, input: {} });

    await expect(
      prisma.planChange.count({ where: { planId: plan.id, status: "proposed" } }),
    ).resolves.toBe(1);

    await expect(
      decidePlanChange({
        changeId: focus?.proposal?.id ?? "",
        goalId: goal.id,
        input: { status: "applied" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(readFocus(goal.id)).resolves.toMatchObject({
      planFocus: ["Direito", "Português"],
      testFocus: ["Direito", "Português"],
    });

    const after = await finishGoalPlacement({ goalId: goal.id, input: {} });

    expect(after.status === "ready" && after.completion.focusTest?.checkpoint?.focus).toMatchObject(
      { proposal: null, state: "current" },
    );
  });

  it("says the plan already follows its suggestion when a focus wouldn't move it", async () => {
    const { goal, plan } = await shortPlanExamGoalFixture({ daysLeft: 10, goal: PLAN_SHOWN });
    const completion = await sit(goal.id, [DONT_KNOW]);

    expect(completion.focusTest?.checkpoint?.focus).toMatchObject({
      proposal: null,
      rows: [{ areas: ["Direito"] }, { areas: ["Português"] }],
      state: "current",
    });

    await expect(
      prisma.planChange.count({ where: { planId: plan.id, status: "proposed" } }),
    ).resolves.toBe(0);

    await expect(readFocus(goal.id)).resolves.toMatchObject({ planFocus: [], testFocus: null });
  });

  it("never proposes again a focus the learner said 'Not now' to", async () => {
    const { goal, plan } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });
    const completion = await sit(goal.id, [DONT_KNOW]);

    await decidePlanChange({
      changeId: completion.focusTest?.checkpoint?.focus?.proposal?.id ?? "",
      goalId: goal.id,
      input: { status: "declined" },
    });

    const again = await finishGoalPlacement({ goalId: goal.id, input: {} });

    expect(again.status === "ready" && again.completion.focusTest?.checkpoint?.focus).toMatchObject(
      { proposal: null, state: "handPicked" },
    );

    await expect(
      prisma.planChange.findMany({
        select: { status: true },
        where: { payload: { equals: "focusTest", path: ["source"] }, planId: plan.id },
      }),
    ).resolves.toStrictEqual([{ status: "declined" }]);
  });
});
