"use server";

import { startGoalWork } from "@/lib/goals/start-goal-work";
import { goalCreateInputSchema } from "@zoonk/core/goals/contract";
import { startGoalFromPlanLink } from "@zoonk/core/plans/start-from-link";
import { type CreateGoalsOutcome } from "@zoonk/learn/onboarding/actions";
import { isUuid } from "@zoonk/utils/uuid";
import { getGoalLimitReason } from "./goal-limit-reason";

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
    return { generationId: null, goalId: result.goal.id, status: "created" };
  }

  if (result.status !== "created") {
    return { status: "failed" };
  }

  const [start] = await startGoalWork([result.goal], { research: false });

  return { generationId: start?.generationId ?? null, goalId: result.goal.id, status: "created" };
}
