import { captureWorkflowFailure } from "@/workflows/_shared/capture-workflow-failure";
import { createStepStream } from "@/workflows/_shared/stream-status";
import { type WorkflowErrorLog } from "@/workflows/_shared/workflow-error";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";

/**
 * Persists failure only while this workflow owns the lesson. A same-run failed
 * row is an idempotent replay after the database write committed, so it still
 * needs the stream event that may have been lost with the earlier step result.
 */
async function persistLessonFailure({
  lessonId,
  workflowRunId,
}: {
  lessonId: string;
  workflowRunId: string;
}): Promise<boolean> {
  return prisma.$transaction(async (transaction) => {
    const lesson = await transaction.lesson.updateMany({
      data: { generationStatus: "failed" },
      where: { generationRunId: workflowRunId, generationStatus: "running", id: lessonId },
    });

    if (lesson.count > 0) {
      return true;
    }

    const persistedLesson = await transaction.lesson.findUnique({ where: { id: lessonId } });

    return (
      persistedLesson?.generationRunId === workflowRunId &&
      persistedLesson.generationStatus === "failed"
    );
  });
}

/**
 * Marks a lesson-generation run as permanently failed after Workflow has
 * exhausted retries for the throwing step. The original error is passed in as
 * serializable data so logs preserve the real AI or database failure.
 */
export async function handleLessonFailureStep(input: {
  error?: WorkflowErrorLog;
  lessonId: string;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  logError("[Lesson Workflow Failure]", { error: input.error, lessonId: input.lessonId });

  await captureWorkflowFailure({
    entity: "lesson",
    entityId: input.lessonId,
    error: input.error,
    workflowName: "lessonGenerationWorkflow",
  });

  const persisted = await persistLessonFailure({
    lessonId: input.lessonId,
    workflowRunId: input.workflowRunId,
  });

  if (!persisted) {
    return;
  }

  await using stream = createStepStream();
  await stream.error({ reason: "aiGenerationFailed", step: WORKFLOW_ERROR_STEP });
}
