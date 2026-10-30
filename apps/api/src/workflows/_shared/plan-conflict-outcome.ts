import { isPlanConflictError } from "@zoonk/core/plans/conflict";
import { type PlanStepOutcome } from "./plan-conflict-retry";

export async function catchPlanConflict<T>(run: () => Promise<T>): Promise<PlanStepOutcome<T>> {
  const [result] = await Promise.allSettled([run()]);

  if (result.status === "fulfilled") {
    return { conflict: false, value: result.value };
  }

  const reason: unknown = result.reason;

  if (isPlanConflictError(reason)) {
    return { conflict: true };
  }

  throw reason;
}
