"use server";

import { type CourseStartFailure } from "@/components/public/use-course-start";
import { startPlanLinkGoal } from "@/lib/goals/start-plan-link-goal";
import { planLinkStartInputSchema } from "@zoonk/core/plans/link-contract";
import { isUuid } from "@zoonk/utils/uuid";

export type StartPlanState = { failure: CourseStartFailure } | { started: true } | null;

export async function startPlanAction(
  planId: string,
  _state: StartPlanState,
  formData: FormData,
): Promise<StartPlanState> {
  const input = planLinkStartInputSchema.safeParse({
    dailyMinutes: Number(formData.get("dailyMinutes")),
    timeZone: formData.get("timeZone") || undefined,
  });

  if (!input.success || !isUuid(planId)) {
    return { failure: { status: "failed" } };
  }

  const result = await startPlanLinkGoal({ input: input.data, planId });

  return result.status === "limitReached" || result.status === "failed"
    ? { failure: result }
    : { started: true };
}
