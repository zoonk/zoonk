import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { FatalError, getWorkflowMetadata } from "workflow";
import { getOrCreateCourse } from "./_internal/get-or-create-course";
import { setupCourse } from "./_internal/setup-course";
import { checkExistingCourseStep } from "./steps/check-existing-course-step";
import { getCourseSuggestionStep } from "./steps/get-course-suggestion-step";
import { handleCourseFailureStep } from "./steps/handle-failure-step";

export async function courseGenerationWorkflow(courseSuggestionId: number): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const suggestion = await getCourseSuggestionStep(courseSuggestionId);

  if (!suggestion) {
    return;
  }

  const existingCourse = await checkExistingCourseStep(suggestion);

  // Skip completed courses (nothing to do) and running courses (avoid conflicts)
  if (
    existingCourse?.generationStatus === "completed" ||
    existingCourse?.generationStatus === "running"
  ) {
    return;
  }

  const { course, existing } = await getOrCreateCourse(
    existingCourse,
    suggestion,
    courseSuggestionId,
    workflowRunId,
  );

  const chapters = await setupCourse(course, courseSuggestionId, existing).catch(
    async (error: unknown) => {
      await handleCourseFailureStep({
        courseId: course.courseId,
        courseSuggestionId,
      });

      console.error(`[workflow ${workflowRunId}] Course generation failed`, error);

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
