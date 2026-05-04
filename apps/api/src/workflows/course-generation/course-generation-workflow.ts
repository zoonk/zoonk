import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { serializeWorkflowError } from "@/workflows/_shared/workflow-error";
import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { COURSE_COMPLETION_STEP } from "@zoonk/core/workflows/steps";
import { type Chapter } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { getWorkflowMetadata } from "workflow";
import { getOrCreateCourse } from "./_internal/get-or-create-course";
import { setupCourse } from "./_internal/setup-course";
import { checkExistingCourseStep } from "./steps/check-existing-course-step";
import { completeCourseSetupStep } from "./steps/complete-course-setup-step";
import { getCourseSuggestionStep } from "./steps/get-course-suggestion-step";
import { handleCourseFailureStep } from "./steps/handle-failure-step";

/**
 * Runs course setup through final persistence and only then marks the course
 * complete. Chapter generation owns chapter-specific content such as
 * thumbnails, so this course setup step only saves course-level metadata and
 * chapter shells.
 */
async function setupCourseContent({
  course,
  description,
  courseSuggestionId,
  existing,
}: {
  course: Awaited<ReturnType<typeof getOrCreateCourse>>["course"];
  description: string | null;
  courseSuggestionId: string;
  existing: Awaited<ReturnType<typeof getOrCreateCourse>>["existing"];
}): Promise<Chapter[]> {
  const chapters = await setupCourse(course, description, existing);

  await completeCourseSetupStep({ courseId: course.courseId, courseSuggestionId });

  return chapters;
}

/**
 * Starts every chapter workflow as one fan-out wave after the course shell is
 * saved. Each chapter workflow owns its own failure state, so the course row can
 * stay completed even when one or more chapters need a retry.
 */
async function generateCourseChapters(chapters: Chapter[]): Promise<void> {
  await Promise.allSettled(chapters.map((chapter) => chapterGenerationWorkflow(chapter.id)));
}

export async function courseGenerationWorkflow(courseSuggestionId: string): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const suggestion = await getCourseSuggestionStep(courseSuggestionId);

  // Skip if actively running to avoid conflicts with another workflow instance.
  if (suggestion.generationStatus === "running") {
    return;
  }

  // Already completed — stream the completion step so the client can redirect.
  if (suggestion.generationStatus === "completed") {
    await streamSkipStep(COURSE_COMPLETION_STEP);
    return;
  }

  const existingCourse = await checkExistingCourseStep(suggestion);

  // Skip running courses to avoid conflicts with another workflow instance.
  if (existingCourse?.generationStatus === "running") {
    return;
  }

  // Already completed — stream the completion step so the client can redirect.
  if (existingCourse?.generationStatus === "completed") {
    await streamSkipStep(COURSE_COMPLETION_STEP);
    return;
  }

  const { course, existing } = await getOrCreateCourse(
    existingCourse,
    suggestion,
    courseSuggestionId,
    workflowRunId,
  ).catch(async (error: unknown) => {
    await handleCourseFailureStep({
      courseId: existingCourse?.id ?? null,
      courseSuggestionId,
      error: serializeWorkflowError(error),
    });

    logError(`[workflow ${workflowRunId}] Course initialization failed`, error);

    throw error;
  });

  const chapters = await setupCourseContent({
    course,
    courseSuggestionId,
    description: suggestion.description,
    existing,
  }).catch(async (error: unknown) => {
    await handleCourseFailureStep({
      courseId: course.courseId,
      courseSuggestionId,
      error: serializeWorkflowError(error),
    });

    logError(`[workflow ${workflowRunId}] Course generation failed`, error);

    throw error;
  });

  // Start chapter generation outside the course error handling.
  // Chapter generation has its own error handling that marks the chapter as failed.
  // We don't want chapter failures to mark the entire course as failed.
  await generateCourseChapters(chapters);
}
