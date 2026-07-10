import { captureWorkflowFailure } from "@/workflows/_shared/capture-workflow-failure";
import { createStepStream } from "@/workflows/_shared/stream-status";
import { type WorkflowErrorLog, serializeWorkflowError } from "@/workflows/_shared/workflow-error";
import { type CourseWorkflowStepName, WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";

/**
 * Persists the course and linked prompt failures in one transaction only when
 * this run still owns the course. The conditional course update acquires the
 * same row lock as generation claims before prompt statuses change, preventing
 * both mismatched state and a stale retry from failing a newer owner.
 */
async function persistCourseFailure({
  courseId,
  coursePromptId,
  workflowRunId,
}: {
  courseId: string;
  coursePromptId: string;
  workflowRunId: string;
}): Promise<boolean> {
  return prisma.$transaction(async (transaction) => {
    const course = await transaction.course.updateMany({
      data: { generationRunId: null, generationStatus: "failed" },
      where: { generationRunId: workflowRunId, generationStatus: "running", id: courseId },
    });

    if (course.count === 0) {
      const persistedCourse = await transaction.course.findUniqueOrThrow({
        where: { id: courseId },
      });

      return (
        persistedCourse.generationRunId === null && persistedCourse.generationStatus === "failed"
      );
    }

    await transaction.coursePrompt.update({
      data: { generationRunId: null, generationStatus: "failed" },
      where: { id: coursePromptId },
    });

    await transaction.coursePrompt.updateMany({
      data: { generationRunId: null, generationStatus: "failed" },
      where: { courseId, generationStatus: { not: "completed" } },
    });

    return true;
  });
}

/**
 * Marks a course-generation run as permanently failed after the workflow has
 * stopped retrying the step that threw. Requests linked by duplicate starts
 * fail with the shared course, but a stale handler becomes a no-op once a new
 * workflow owns the course or prompt.
 */
export async function handleCourseFailureStep(input: {
  courseId: string | null;
  coursePromptId: string;
  error?: WorkflowErrorLog;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  const { courseId, coursePromptId } = input;

  logError("[Course Workflow Failure]", { courseId, coursePromptId, error: input.error });

  await captureWorkflowFailure({
    entity: "course",
    entityId: courseId ?? coursePromptId,
    error: input.error,
    workflowName: "courseGenerationWorkflow",
  });

  if (courseId) {
    try {
      const persisted = await persistCourseFailure({
        courseId,
        coursePromptId,
        workflowRunId: input.workflowRunId,
      });

      if (!persisted) {
        return;
      }
    } catch (error) {
      logError("[Course Workflow Failure Status Update Failed]", {
        errors: [serializeWorkflowError(error)],
      });

      throw error;
    }
  } else {
    const prompt = await prisma.coursePrompt.updateMany({
      data: { courseId: null, generationRunId: null, generationStatus: "failed" },
      where: {
        OR: [{ generationRunId: null }, { generationRunId: input.workflowRunId }],
        generationStatus: { not: "completed" },
        id: coursePromptId,
      },
    });

    if (prompt.count === 0) {
      return;
    }
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
