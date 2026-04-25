import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type WorkflowErrorLog } from "@/workflows/_shared/workflow-error";
import { type ActivityStepName, type WorkflowErrorReason } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * Records a permanent activity-generation failure after workflow retries are
 * exhausted. Generation steps should throw and let Workflow retry them; callers
 * use this step only from final catch blocks so the DB state and SSE error event
 * represent a real terminal failure, not a transient attempt.
 */
export async function handleActivityFailureStep(input: {
  activityId: string;
  error?: WorkflowErrorLog;
  reason?: WorkflowErrorReason;
}): Promise<void> {
  "use step";

  logError("[Activity Failure]", {
    activityId: input.activityId,
    error: input.error,
  });

  const { error } = await safeAsync(() =>
    prisma.activity.update({
      data: { generationStatus: "failed" },
      where: { id: input.activityId },
    }),
  );

  if (error) {
    logError("[Activity Failure Status Update Failed]", error);
    throw error;
  }

  await using stream = createEntityStepStream<ActivityStepName>(input.activityId);
  await stream.error({
    reason: input.reason ?? "aiGenerationFailed",
    step: "workflowError",
  });
}
