import { createStepStream } from "@/workflows/_shared/stream-status";
import { type WorkflowErrorLog } from "@/workflows/_shared/workflow-error";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * Marks published activities left in "running" state by initial generation as
 * failed.
 *
 * Regeneration intentionally does not go through this path. Hidden replacement
 * activities belong to the outer lesson-regeneration workflow, which deletes
 * that temporary replacement set on failure instead of keeping failed rows
 * around.
 */
export async function handleWorkflowFailureStep(input: {
  error?: WorkflowErrorLog;
  lessonId: string;
}): Promise<void> {
  "use step";

  logError("[Activity Workflow Failure]", {
    error: input.error,
    lessonId: input.lessonId,
  });

  const { error } = await safeAsync(() =>
    prisma.activity.updateMany({
      data: { generationStatus: "failed" },
      where: {
        archivedAt: null,
        generationStatus: "running",
        isPublished: true,
        lessonId: input.lessonId,
      },
    }),
  );

  if (error) {
    logError("[Activity Workflow Failure Status Update Failed]", error);
    throw error;
  }

  await using stream = createStepStream<ActivityStepName>();
  await stream.error({ reason: "aiGenerationFailed", step: "workflowError" });
}
