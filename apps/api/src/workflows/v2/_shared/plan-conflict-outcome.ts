import { isPlanConflictError } from "@zoonk/core/plans/conflict";
import { type PlanStepOutcome } from "./plan-conflict-retry";

/**
 * Runs planning inside a step and says when the plan kept changing while it was planned (other
 * runs saving the lessons and questions it plans from, see `isPlanConflictError`), for the run to
 * try again after a durable wait (see `retryPlanConflicts`); every other error throws, keeping the
 * runtime's own retries.
 */
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
