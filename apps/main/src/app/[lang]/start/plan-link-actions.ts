"use server";

import { startGoalWork } from "@/lib/goals/start-goal-work";
import { goalCreateInputSchema } from "@zoonk/core/goals/contract";
import { startGoalFromPlanLink } from "@zoonk/core/plans/start-from-link";
import { type CreateGoalsOutcome } from "@zoonk/learn/onboarding/actions";
import { isUuid } from "@zoonk/utils/uuid";
import { getGoalLimitReason } from "./goal-limit-reason";

/**
 * Onboarding opened from someone's plan link: the learner's answers (their time, days and date)
 * start their own goal from that plan's structure instead of a new plan. The same capability as
 * `POST /v1/plan-links/{planId}/goals`. A new goal's run then writes ahead what its plan needs
 * (placement's questions, the first lessons); the plan exists, so nothing waits for research.
 */
export async function createGoalsFromPlanLinkAction(
  planId: string,
  input: unknown,
): Promise<CreateGoalsOutcome> {
  const parsed = goalCreateInputSchema.safeParse(input);
  const [draft] = parsed.success ? parsed.data.goals : [];

  if (!parsed.success || !draft || !isUuid(planId)) {
    return { status: "failed" };
  }

  const result = await startGoalFromPlanLink({
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

  if (result.status === "refused") {
    return { reason: getGoalLimitReason(result.refusals[0]?.decision), status: "limitReached" };
  }

  if (result.status === "owner") {
    return { generationStarted: true, goalId: result.goal.id, status: "created" };
  }

  if (result.status !== "created") {
    return { status: "failed" };
  }

  const [start] = await startGoalWork([result.goal], { research: false });

  return {
    generationStarted: Boolean(start?.generationId),
    goalId: result.goal.id,
    status: "created",
  };
}
