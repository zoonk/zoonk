import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { isJsonObject } from "@zoonk/utils/json";
import { describe, expect, it } from "vitest";
import { ENERGY_PER_CORRECT } from "../../progress/energy";
import { PLAN_SHOWN, examTestGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";

async function readProgress(userId: string) {
  const [energy, daily] = await Promise.all([
    prisma.userProgress.findUnique({ where: { userId } }),
    prisma.dailyProgress.aggregate({
      _sum: { correctAnswers: true, incorrectAnswers: true, timeSpentSeconds: true },
      where: { userId },
    }),
  ]);

  return { energy: energy?.currentEnergy ?? 0, ...daily._sum };
}

describe("overlapping Focus tests", () => {
  it.each([false, true])(
    "rewards an answer only in its own sitting (other finishes first: %s)",
    async (otherFirst) => {
      const { blueprint, goal, plan, skills, user } = await examTestGoalFixture({
        goal: PLAN_SHOWN,
        subjects: [{ items: 8, name: "Math", questions: 10 }],
      });

      const other = await goalFixture({
        ...PLAN_SHOWN,
        examBlueprintId: blueprint.id,
        kind: "exam",
        targetDate: goal.targetDate,
        userId: user.id,
      });

      const otherPlan = await planFixture({
        goalId: other.id,
        graph: isJsonObject(plan.graph) ? plan.graph : {},
        placementPreparedAt: new Date(),
      });

      await Promise.all(
        skills.map((skill, position) =>
          planItemFixture({ phase: 0, planId: otherPlan.id, position, skillId: skill.id }),
        ),
      );

      const started = await startSitting(goal.id);
      await startSitting(other.id);

      await expect(
        answerPlacementQuestion({
          goalId: goal.id,
          input: {
            answer: { selectedIndex: 0 },
            durationMs: 20_000,
            itemId: started.next?.itemId ?? "",
          },
        }),
      ).resolves.toMatchObject({ status: "ready" });

      await expect(getGoalPlacement({ goalId: other.id })).resolves.toMatchObject({
        placement: { focusTest: { sitting: { answered: 0 }, subjects: [{ asked: 1 }] } },
      });

      const order = otherFirst ? [other.id, goal.id] : [goal.id, other.id];

      await expect(finishGoalPlacement({ goalId: order[0]!, input: {} })).resolves.toMatchObject({
        status: "ready",
      });

      await expect(finishGoalPlacement({ goalId: order[1]!, input: {} })).resolves.toMatchObject({
        status: "ready",
      });

      await expect(readProgress(user.id)).resolves.toMatchObject({
        correctAnswers: 1,
        energy: ENERGY_PER_CORRECT,
        incorrectAnswers: 0,
        timeSpentSeconds: 20,
      });

      await expect(
        prisma.learningEvent.findMany({
          select: { energyDelta: true, goalId: true },
          where: { lessonKind: "focusTest", userId: user.id },
        }),
      ).resolves.toStrictEqual([{ energyDelta: ENERGY_PER_CORRECT, goalId: goal.id }]);
    },
  );
});
