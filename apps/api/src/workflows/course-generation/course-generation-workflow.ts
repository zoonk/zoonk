import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { logError } from "@zoonk/utils/logger";
import { FatalError, getWorkflowMetadata } from "workflow";
import { getOrCreateCourse } from "./_internal/get-or-create-course";
import { setupCourse } from "./_internal/setup-course";
import { checkExistingCourseStep } from "./steps/check-existing-course-step";
import { getCourseSuggestionStep } from "./steps/get-course-suggestion-step";
import { handleCourseFailureStep } from "./steps/handle-failure-step";
import { streamStatus } from "./stream-status";

export async function courseGenerationWorkflow(courseSuggestionId: number): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const suggestion = await getCourseSuggestionStep(courseSuggestionId);

  // Skip if actively running to avoid conflicts with another workflow instance.
  if (suggestion.generationStatus === "running") {
    return;
  }

  // Already completed — stream the completion step so the client can redirect.
  if (suggestion.generationStatus === "completed") {
    await streamStatus({ status: "completed", step: "setFirstActivityAsCompleted" });
    return;
  }

  const existingCourse = await checkExistingCourseStep(suggestion);

  // Skip running courses to avoid conflicts with another workflow instance.
  if (existingCourse?.generationStatus === "running") {
    return;
  }

  // Already completed — stream the completion step so the client can redirect.
  if (existingCourse?.generationStatus === "completed") {
    await streamStatus({ status: "completed", step: "setFirstActivityAsCompleted" });
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
    });

    logError(`[workflow ${workflowRunId}] Course initialization failed`, error);

    throw FatalError;
  });

  const chapters = await setupCourse(course, courseSuggestionId, existing).catch(
    async (error: unknown) => {
      await handleCourseFailureStep({
        courseId: course.courseId,
        courseSuggestionId,
      });

      logError(`[workflow ${workflowRunId}] Course generation failed`, error);

      throw FatalError;
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
