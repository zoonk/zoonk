import { createStepStream } from "@/workflows/_shared/stream-status";
import { type WorkflowErrorLog, serializeWorkflowError } from "@/workflows/_shared/workflow-error";
import { type CourseWorkflowStepName, WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getSettledFailureError, settledFailures } from "@zoonk/utils/settled";

/**
 * Marks a course-generation run as permanently failed after the workflow has
 * stopped retrying the step that threw. The original error is logged here so
 * Workflow can keep retryable steps clean while final failure diagnostics still
 * show the provider or database error that caused the run to fail.
 */
export async function handleCourseFailureStep(input: {
  courseId: string | null;
  courseSuggestionId: string;
  error?: WorkflowErrorLog;
}): Promise<void> {
  "use step";

  const { courseId, courseSuggestionId } = input;

  logError("[Course Workflow Failure]", {
    courseId,
    courseSuggestionId,
    error: input.error,
  });

  if (courseId) {
    const results = await Promise.allSettled([
      prisma.course.update({
        data: { generationRunId: null, generationStatus: "failed" },
        where: { id: courseId },
      }),
      prisma.courseSuggestion.update({
        data: { generationRunId: null, generationStatus: "failed" },
        where: { id: courseSuggestionId },
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
    await prisma.courseSuggestion.update({
      data: { generationRunId: null, generationStatus: "failed" },
      where: { id: courseSuggestionId },
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

  logError("[Chapter Workflow Failure]", {
    chapterId: input.chapterId,
    error: input.error,
  });

  const { error } = await safeAsync(() =>
    prisma.chapter.update({
      data: { generationRunId: null, generationStatus: "failed" },
      where: { id: input.chapterId },
    }),
  );

  if (error) {
    logError("[Chapter Workflow Failure Status Update Failed]", error);
    throw error;
  }

  await using stream = createStepStream<CourseWorkflowStepName>();
  await stream.error({ reason: "aiGenerationFailed", step: WORKFLOW_ERROR_STEP });
}
