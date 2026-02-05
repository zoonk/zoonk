import { type ActivityKind } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getActivityHookToken } from "../../activity-dependency-graph";
import { activityContentCompletedHook } from "../../activity-hooks";
import { streamStatus } from "../../stream-status";
import { type ActivitySteps, getActivitySteps } from "../_utils/get-activity-steps";

/**
 * Notifies dependent workflows that this activity's content is ready.
 * All workflows waiting for this activity kind will wake up and receive the steps.
 *
 * This should be called immediately after content generation, before visuals/images.
 * This allows dependents to start their content generation in parallel with visuals.
 */
export async function notifyDependentsStep(params: {
  activityId: bigint;
  activityKind: ActivityKind;
  lessonId: number;
  /** Steps to send. If not provided, fetches from DB (for already-completed activities). */
  steps?: ActivitySteps;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "notifyDependents" });

  // Get steps from DB if not provided (for already-completed activities)
  const steps = params.steps ?? (await getActivitySteps(params.activityId));

  const token = getActivityHookToken(params.activityKind, params.lessonId);

  // Resume the hook - all workflows waiting for this activity kind will wake up
  // Using safeAsync because hook might not exist if no workflows are waiting
  await safeAsync(() =>
    activityContentCompletedHook.resume(token, {
      activityId: params.activityId,
      activityKind: params.activityKind,
      lessonId: params.lessonId,
      steps,
    }),
  );

  await streamStatus({ status: "completed", step: "notifyDependents" });
}
