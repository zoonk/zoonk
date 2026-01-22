import { getWorkflowMetadata } from "workflow";
import { addAlternativeTitlesStep } from "./steps/add-alternative-titles-step";
import { addCategoriesStep } from "./steps/add-categories-step";
import { addChaptersStep } from "./steps/add-chapters-step";
import { checkExistingCourseStep } from "./steps/check-existing-course-step";
import { completeCourseSetupStep } from "./steps/complete-course-setup-step";
import { generateAlternativeTitlesStep } from "./steps/generate-alternative-titles-step";
import { generateCategoriesStep } from "./steps/generate-categories-step";
import { generateChaptersStep } from "./steps/generate-chapters-step";
import { generateDescriptionStep } from "./steps/generate-description-step";
import { generateImageStep } from "./steps/generate-image-step";
import { getCourseSuggestionStep } from "./steps/get-course-suggestion-step";
import { handleCourseFailureStep } from "./steps/handle-failure-step";
import { initializeCourseStep } from "./steps/initialize-course-step";
import { startChapterGenerationStep } from "./steps/start-chapter-generation-step";
import { updateCourseStep } from "./steps/update-course-step";

export async function courseGenerationWorkflow(
  courseSuggestionId: number,
): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const suggestion = await getCourseSuggestionStep(courseSuggestionId);

  if (!suggestion) {
    return;
  }

  const existingCourse = await checkExistingCourseStep(suggestion);

  if (existingCourse) {
    return;
  }

  const course = await initializeCourseStep({
    suggestion,
    workflowRunId,
  });

  try {
    const [
      description,
      imageUrl,
      alternativeTitles,
      categories,
      generatedChapters,
    ] = await Promise.all([
      generateDescriptionStep(course),
      generateImageStep(course),
      generateAlternativeTitlesStep(course),
      generateCategoriesStep(course),
      generateChaptersStep(course),
    ]);

    const [, , , createdChapters] = await Promise.all([
      updateCourseStep({ course, description, imageUrl }),
      addAlternativeTitlesStep({ alternativeTitles, course }),
      addCategoriesStep({ categories, course }),
      addChaptersStep({
        chapters: generatedChapters,
        course,
      }),
    ]);

    await completeCourseSetupStep({
      courseId: course.courseId,
      courseSuggestionId,
    });

    const firstChapter = createdChapters[0];

    if (firstChapter) {
      await startChapterGenerationStep(firstChapter);
    }
  } catch (error) {
    await handleCourseFailureStep({
      courseId: course.courseId,
      courseSuggestionId,
    });
    throw error;
  }
}
