import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it } from "vitest";
import { settleNewPlan } from "../../plans/_utils/recommended-bases";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { getPlanTimeAdvice } from "../../plans/get-time-advice";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { answerOnboardingQuestion } from "../../view-models/onboarding/answer-onboarding-question";
import { getTodayView } from "../../view-models/today/get-today-view";
import { PLAN_SHOWN, shortPlanExamGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { writeLearnerChange } from "../_utils/write-learner-change";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { readFocusTestRecord } from "./focus-test-state";
import { getGoalPlacement } from "./get-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

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

    await expect(
      answerOnboardingQuestion({
        goalId: goal.id,
        input: { dailyMinutes: 5, question: "schedule", timeZone: "UTC" },
      }),
    ).resolves.toMatchObject({ status: "saved" });

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

  it.each([false, true])(
    "keeps an old test's focus ownership only while its change still sets it (hand-picked: %s)",
    async (handPicked) => {
      const { goal, plan, user } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });
      await prisma.goal.update({ data: { details: PLAN_SHOWN.details }, where: { id: goal.id } });

      const areas = ["Direito"];
      const payload = { operations: [{ areas, kind: "focusAreas" }], source: "learner" };
      const original = await planChangeFixture({ payload, planId: plan.id, status: "applied" });

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

      if (handPicked) {
        await planChangeFixture({
          createdAt: new Date(original.createdAt.getTime() + 1),
          payload,
          planId: plan.id,
          status: "applied",
        });
      }

      await startPlacementSitting({ goalId: goal.id, input: {} });

      await expect(readFocus(goal.id)).resolves.toMatchObject({
        planFocus: areas,
        testFocus: handPicked ? null : areas,
      });
    },
  );

  it("keeps a device-zone proposal applicable when the goal has no stored time zone", async () => {
    const timeZone = "America/Sao_Paulo";

    const { goal, plan } = await shortPlanExamGoalFixture({
      goal: { ...PLAN_SHOWN, timezone: null },
    });

    const first = await startSitting(goal.id);

    await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: DONT_KNOW, durationMs: 20_000, itemId: first.next?.itemId ?? "", timeZone },
    });

    const result = await finishGoalPlacement({ goalId: goal.id, input: { timeZone } });

    const proposal = await prisma.planChange.findFirstOrThrow({
      where: { planId: plan.id, status: "proposed" },
    });

    expect(proposal.payload).toMatchObject({ previewBasis: { timeZone } });

    expect(result).toMatchObject({
      completion: { focusTest: { checkpoint: { focus: { proposal: { canApply: true } } } } },
    });

    await expect(getGoalPlacement({ goalId: goal.id, timeZone })).resolves.toMatchObject({
      placement: { focusTest: { checkpoint: { focus: { proposal: { canApply: true } } } } },
    });

    await expect(getTodayView({ goalId: goal.id, timeZone })).resolves.toMatchObject({
      today: { planChange: { canApply: true } },
    });

    await expect(
      decidePlanChange({
        changeId: proposal.id,
        goalId: goal.id,
        input: { status: "applied", timeZone },
      }),
    ).resolves.toMatchObject({ status: "updated" });
  });

  it("proposes when the daily time was saved but the learner hasn't passed the reveal", async () => {
    const { goal } = await shortPlanExamGoalFixture({
      goal: { ...PLAN_SHOWN, planRevealedAt: null },
    });

    const completion = await sit(goal.id, [DONT_KNOW]);

    expect(completion.focusTest?.checkpoint?.focus).toMatchObject({
      proposal: { source: "focusTest", status: "proposed" },
      state: "proposed",
    });
  });

  it("does not call an immovable focus already covered", async () => {
    const { goal, plan } = await shortPlanExamGoalFixture({ daysLeft: 10, goal: PLAN_SHOWN });
    const completion = await sit(goal.id, [DONT_KNOW]);

    expect(completion.focusTest?.checkpoint?.focus).toBeNull();

    await expect(getGoalPlacement({ goalId: goal.id })).resolves.toMatchObject({
      placement: { focusTest: { checkpoint: { focus: null } } },
    });

    await expect(
      prisma.planChange.count({ where: { planId: plan.id, status: "proposed" } }),
    ).resolves.toBe(0);

    await expect(readFocus(goal.id)).resolves.toMatchObject({ planFocus: [], testFocus: null });
  });

  it("keeps alreadyFits after an unrelated answer bumps plan inputs", async () => {
    const { goal, user } = await shortPlanExamGoalFixture({
      daysLeft: 10,
      goal: PLAN_SHOWN,
      lessons: 1,
    });

    const completion = await sit(goal.id, [DONT_KNOW]);
    expect(completion.focusTest?.checkpoint?.focus?.state).toBe("alreadyFits");

    await writeLearnerChange({ planInputs: true, userId: user.id }, async () => null);

    await expect(getGoalPlacement({ goalId: goal.id })).resolves.toMatchObject({
      placement: { focusTest: { checkpoint: { focus: { state: "alreadyFits" } } } },
    });
  });

  it("calls an unchanged focus already covered only when every suggested lesson is in the plan", async () => {
    const { goal } = await shortPlanExamGoalFixture({ daysLeft: 10, goal: PLAN_SHOWN, lessons: 1 });

    const completion = await sit(goal.id, [DONT_KNOW]);

    expect(completion.focusTest?.checkpoint?.focus).toMatchObject({
      proposal: null,
      state: "alreadyFits",
    });

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ areas: ["Direito", "Português"], kind: "focusAreas" }] },
        trackAnalytics: false,
      }),
    ).resolves.toMatchObject({ reason: "alreadyIn", status: "unchanged" });
  });

  it.each(["date", "daily time"])(
    "reconsiders an unchanged focus after changing the %s",
    async (changed) => {
      const { goal } = await shortPlanExamGoalFixture({ daysLeft: 10, goal: PLAN_SHOWN });
      await sit(goal.id, [DONT_KNOW]);

      const moved = await changeGoalPlan({
        goalId: goal.id,
        input: {
          operations:
            changed === "date"
              ? [
                  {
                    kind: "setTargetDate",
                    targetDate: new Date(Date.now() + 30 * MS_PER_DAY).toISOString().slice(0, 10),
                  },
                ]
              : [{ kind: "setDailyMinutes", minutes: 15 }],
        },
        trackAnalytics: false,
      });

      expect(moved.status).toBe("applied");
      const after = await finishGoalPlacement({ goalId: goal.id, input: {} });

      expect(after).toMatchObject({
        completion: {
          focusTest: {
            checkpoint: {
              focus:
                changed === "date"
                  ? { proposal: { source: "focusTest" }, state: "proposed" }
                  : null,
            },
          },
        },
        status: "ready",
      });

      const stored = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

      expect(readFocusTestRecord(stored)?.handled).toMatchObject({
        dailyMinutes: stored.dailyMinutes,
        targetDate: stored.targetDate?.toISOString().slice(0, 10) ?? null,
      });
    },
  );

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

  it.each(["declined", "undone"] as const)(
    "keeps a %s proposal dismissed after a date edit and settlement",
    async (status) => {
      const { goal, plan, user } = await shortPlanExamGoalFixture({ goal: PLAN_SHOWN });
      const completion = await sit(goal.id, [DONT_KNOW]);
      const changeId = completion.focusTest?.checkpoint?.focus?.proposal?.id ?? "";

      if (status === "undone") {
        await decidePlanChange({ changeId, goalId: goal.id, input: { status: "applied" } });
      }

      await expect(
        decidePlanChange({ changeId, goalId: goal.id, input: { status } }),
      ).resolves.toMatchObject({ change: { status }, status: "updated" });

      await expect(getGoalPlacement({ goalId: goal.id })).resolves.toMatchObject({
        placement: {
          focusTest: { checkpoint: { focus: { proposal: null, state: "handPicked" } } },
        },
      });

      await expect(getTodayView({ goalId: goal.id })).resolves.toMatchObject({
        today: { planChange: null },
      });

      await writeLearnerChange({ planInputs: true, userId: user.id }, async () => null);

      await expect(getGoalPlacement({ goalId: goal.id })).resolves.toMatchObject({
        placement: { focusTest: { checkpoint: { focus: { state: "handPicked" } } } },
      });

      await expect(
        prisma.planChange.count({
          where: { payload: { equals: "focusTest", path: ["source"] }, planId: plan.id },
        }),
      ).resolves.toBe(1);

      await expect(
        changeGoalPlan({
          goalId: goal.id,
          input: {
            operations: [
              {
                kind: "setTargetDate",
                targetDate: new Date(Date.now() + 40 * MS_PER_DAY).toISOString().slice(0, 10),
              },
            ],
          },
          trackAnalytics: false,
        }),
      ).resolves.toMatchObject({ status: "applied" });

      await expect(finishGoalPlacement({ goalId: goal.id, input: {} })).resolves.toMatchObject({
        completion: {
          focusTest: { checkpoint: { focus: { proposal: null, state: "handPicked" } } },
        },
      });

      await expect(
        prisma.planChange.findMany({
          select: { status: true },
          where: { payload: { equals: "focusTest", path: ["source"] }, planId: plan.id },
        }),
      ).resolves.toStrictEqual([{ status }]);
    },
  );
});
