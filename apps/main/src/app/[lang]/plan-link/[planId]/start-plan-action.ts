"use server";

import { planLinkStartInputSchema } from "@zoonk/core/plans/link-contract";
import { startGoalFromPlanLink } from "@zoonk/core/plans/start-from-link";

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

  if (!input.success) {
    return { error: "failed" };
  }

  const result = await startGoalFromPlanLink({ input: input.data, planId });

  if (result.status === "refused") {
    return { error: "refused" };
  }

  if (result.status !== "created" && result.status !== "owner") {
    return { error: "failed" };
  }

  return { started: true };
}
