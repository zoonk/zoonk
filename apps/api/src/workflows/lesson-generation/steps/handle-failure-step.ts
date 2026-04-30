import { createStepStream } from "@/workflows/_shared/stream-status";
import { type WorkflowErrorLog } from "@/workflows/_shared/workflow-error";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";

/**
 * Marks a lesson-generation run as permanently failed after Workflow has
 * exhausted retries for the throwing step. The original error is passed in as
 * serializable data so logs preserve the real AI or database failure.
 */
export async function handleLessonFailureStep(input: {
  error?: WorkflowErrorLog;
  lessonId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream();

  logError("[Lesson Workflow Failure]", { error: input.error, lessonId: input.lessonId });

  await prisma.lesson.update({
    data: { generationStatus: "failed" },
    where: { id: input.lessonId },
  });

  await stream.error({ reason: "aiGenerationFailed", step: WORKFLOW_ERROR_STEP });
}
