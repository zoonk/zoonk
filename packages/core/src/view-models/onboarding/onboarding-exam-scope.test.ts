import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import {
  ENGLISH_JA,
  FOREIGN_JA,
  MATH_II_B_C,
  MATH_I_A,
  commonTestBlueprintFixture,
} from "../../exams/choices/_test-utils/choice-blueprint";
import { createGoals } from "../../goals/create-goals";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { getOnboarding } from "./get-onboarding";

async function startCommonTestGoal({
  examSubjects,
  title,
}: {
  examSubjects?: string[];
  title: string;
}) {
  const user = await userFixture();
  const blueprint = await commonTestBlueprintFixture();
  mockSession(user.id);

  const result = await createGoals({
    dailyMinutes: 60,
    goals: [
      {
        details: { examName: "共通テスト", ...(examSubjects ? { examSubjects } : {}) },
        examBlueprintId: blueprint.id,
        kind: "exam",
        language: "ja",
        prompt: "1月の共通テストで英語と数学を伸ばしたい",
        title,
      },
    ],
    timeZone: "Asia/Tokyo",
  });

  const goalId = result.status === "created" ? result.goals[0]?.id : null;

  if (!goalId) {
    throw new Error(`The goal wasn't created: ${result.status}`);
  }

  const onboarding = await getOnboarding({ goalId });

  if (onboarding.status !== "ready") {
    throw new Error(`Onboarding isn't ready: ${onboarding.status}`);
  }

  return { goalId, onboarding: onboarding.onboarding };
}

describe("onboarding a goal for some of an exam's subjects", () => {
  it("doesn't ask for the foreign language the learner named, and counts only their subjects", async () => {
    const { goalId, onboarding } = await startCommonTestGoal({
      examSubjects: ["英語", "数学"],
      title: "共通テストの英語・数学対策",
    });

    expect(onboarding.steps).not.toContain("examChoice");
    expect(onboarding.examChoices).toStrictEqual([]);

    expect(onboarding.examSubjects.map((subject) => subject.name)).toStrictEqual([
      MATH_I_A,
      MATH_II_B_C,
      ENGLISH_JA,
    ]);

    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    expect(parsePlanSettings(plan.settings).examSubjects).toStrictEqual(["英語", "数学"]);
    expect(goal.details).not.toHaveProperty("examSubjects");
  });

  it("asks for the foreign language when the learner prepares the whole exam", async () => {
    const { onboarding } = await startCommonTestGoal({ title: "共通テスト対策" });

    expect(onboarding.steps).toContain("examChoice");
    expect(onboarding.examChoices.map((choice) => choice.group)).toStrictEqual([FOREIGN_JA]);
  });
});
