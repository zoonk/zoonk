import { captureWorkflowFailure } from "@/workflows/_shared/capture-workflow-failure";
import { createStepStream } from "@/workflows/_shared/stream-status";
import { type WorkflowErrorLog, serializeWorkflowError } from "@/workflows/_shared/workflow-error";
import { type CourseWorkflowStepName, WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { getSettledFailureError, settledFailures } from "@zoonk/utils/settled";

/**
 * Marks a course-generation run as permanently failed after the workflow has
 * stopped retrying the step that threw. Requests linked by duplicate starts
 * fail with the shared course so no request stays stuck in a running state
 * after the winning workflow gives up.
 */
export async function handleCourseFailureStep(input: {
  courseId: string | null;
  courseStartRequestId: string;
  error?: WorkflowErrorLog;
}): Promise<void> {
  "use step";

  const { courseId, courseStartRequestId } = input;

  logError("[Course Workflow Failure]", { courseId, courseStartRequestId, error: input.error });

  await captureWorkflowFailure({
    entity: "course",
    entityId: courseId ?? courseStartRequestId,
    error: input.error,
    workflowName: "courseGenerationWorkflow",
  });

  if (courseId) {
    const results = await Promise.allSettled([
      prisma.course.update({
        data: { generationRunId: null, generationStatus: "failed" },
        where: { id: courseId },
      }),
      prisma.courseStartRequest.update({
        data: { generationRunId: null, generationStatus: "failed" },
        where: { id: courseStartRequestId },
      }),
      prisma.courseStartRequest.updateMany({
        data: { generationRunId: null, generationStatus: "failed" },
        where: { courseId, generationStatus: { not: "completed" } },
      }),
    ]);

    const failures = settledFailures(results);

    const failureError = getSettledFailureError({
      failures,
      message: "Failed to mark course workflow as failed",
    });

    if (failureError) {
      logError("[Course Workflow Failure Status Update Failed]", {
        errors: failures.map((failure) => serializeWorkflowError(failure)),
      });

      throw failureError;
    }
  } else {
    await prisma.courseStartRequest.update({
      data: { generationRunId: null, generationStatus: "failed" },
      where: { id: courseStartRequestId },
    });
  }

  await using stream = createStepStream<CourseWorkflowStepName>();
  await stream.error({ reason: "aiGenerationFailed", step: WORKFLOW_ERROR_STEP });
}

/**
 * Marks a chapter-generation run as permanently failed only after the
 * chapter-level workflow catch receives the final error. Individual chapter
 * steps should throw and let Workflow retry before this status is written.
 */
export async function handleChapterFailureStep(input: {
  chapterId: string;
  error?: WorkflowErrorLog;
}): Promise<void> {
  "use step";

  logError("[Chapter Workflow Failure]", { chapterId: input.chapterId, error: input.error });

  await captureWorkflowFailure({
    entity: "chapter",
    entityId: input.chapterId,
    error: input.error,
    workflowName: "chapterGenerationWorkflow",
  });

  await prisma.chapter.update({
    data: { generationRunId: null, generationStatus: "failed" },
    where: { id: input.chapterId },
  });

  await using stream = createStepStream<CourseWorkflowStepName>();
  await stream.error({ reason: "aiGenerationFailed", step: WORKFLOW_ERROR_STEP });
}
