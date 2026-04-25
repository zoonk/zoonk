import { serializeWorkflowError } from "@/workflows/_shared/workflow-error";
import { type WorkflowErrorReason } from "@zoonk/core/workflows/steps";
import { handleActivityFailureStep } from "./steps/handle-failure-step";

/**
 * Converts a final activity-kind workflow error into permanent activity state.
 * Step functions should still throw their original errors so Workflow can retry
 * them; this helper is only for catch blocks that run after those retries are
 * exhausted and need to update the affected activity row.
 */
export async function failActivityWorkflow({
  activityId,
  error,
  reason,
}: {
  activityId: string;
  error: unknown;
  reason?: WorkflowErrorReason;
}): Promise<never> {
  await handleActivityFailureStep({
    activityId,
    error: serializeWorkflowError(error),
    reason,
  });

  throw error;
}

/**
 * Marks every activity that depends on the same failed workflow branch, then
 * rethrows the original error so the branch remains failed in Workflow
 * observability. Use this only when those activities cannot complete without
 * the same upstream artifact, such as translation depending on vocabulary.
 */
export async function failActivityWorkflows({
  activityIds,
  error,
  reason,
}: {
  activityIds: string[];
  error: unknown;
  reason?: WorkflowErrorReason;
}): Promise<never> {
  await Promise.all(
    activityIds.map((activityId) =>
      handleActivityFailureStep({
        activityId,
        error: serializeWorkflowError(error),
        reason,
      }),
    ),
  );

  throw error;
}
