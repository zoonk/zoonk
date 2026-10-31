"use server";

import { startPlanLinkGoal } from "@/lib/goals/start-plan-link-goal";
import { planLinkStartInputSchema } from "@zoonk/core/plans/link-contract";
import { isUuid } from "@zoonk/utils/uuid";

export type StartPlanState = { error: "failed" | "refused" } | { started: true } | null;

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
    return { error: "failed" };
  }

  const result = await startPlanLinkGoal({ input: input.data, planId });

  if (result.status === "limitReached") {
    return { error: "refused" };
  }

  return result.status === "failed" ? { error: "failed" } : { started: true };
}
