"use server";

import { startPlanLinkGoal } from "@/lib/goals/start-plan-link-goal";
import { goalCreateInputSchema } from "@zoonk/core/goals/contract";
import { getGoalGenerationId } from "@zoonk/core/goals/generation-id";
import { type CreateGoalsOutcome } from "@zoonk/learn/onboarding/actions";
import { isUuid } from "@zoonk/utils/uuid";

export async function createGoalsFromPlanLinkAction(
  planId: string,
  input: unknown,
): Promise<CreateGoalsOutcome> {
  const parsed = goalCreateInputSchema.safeParse(input);
  const [draft] = parsed.success ? parsed.data.goals : [];

  if (!parsed.success || !draft || !isUuid(planId)) {
    return { status: "failed" };
  }

  const result = await startPlanLinkGoal({
    input: {
      dailyMinutes: parsed.data.dailyMinutes,
      studyDays: parsed.data.studyDays,
      studyTime: parsed.data.studyTime,
      targetDate: draft.targetDate,
      timeZone: parsed.data.timeZone,
      title: draft.title,
    },
    planId,
  });

  if (result.status === "owner") {
    return { generationId: null, goalId: result.goalId, status: "created" };
  }

  if (result.status !== "created") {
    return result;
  }

  const generation = await getGoalGenerationId({ goalId: result.goalId });

  return {
    generationId: generation.status === "ready" ? generation.generationId : null,
    goalId: result.goalId,
    status: "created",
  };
}
