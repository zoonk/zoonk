import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { serializeWorkflowError } from "@/workflows/_shared/workflow-error";
import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { COURSE_COMPLETION_STEP } from "@zoonk/core/workflows/steps";
import { logError } from "@zoonk/utils/logger";
import { getWorkflowMetadata } from "workflow";
import { getOrCreateCourse } from "./_internal/get-or-create-course";
import { setupCourse } from "./_internal/setup-course";
import { checkExistingCourseStep } from "./steps/check-existing-course-step";
import { getCourseSuggestionStep } from "./steps/get-course-suggestion-step";
import { handleCourseFailureStep } from "./steps/handle-failure-step";

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

  const chapters = await setupCourse(course, courseSuggestionId, existing).catch(
    async (error: unknown) => {
      await handleCourseFailureStep({
        courseId: course.courseId,
        courseSuggestionId,
        error: serializeWorkflowError(error),
      });

      logError(`[workflow ${workflowRunId}] Course generation failed`, error);

      throw error;
    },
  );

  // Start chapter generation outside the course error handling.
  // Chapter generation has its own error handling that marks the chapter as failed.
  // We don't want chapter failures to mark the entire course as failed.
  const firstChapter = chapters[0];

  if (firstChapter) {
    await chapterGenerationWorkflow(firstChapter.id);
  }
}
