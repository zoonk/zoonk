import { type ExistingCourse } from "../steps/check-existing-course-step";
import { getAIOrganizationStep } from "../steps/get-ai-organization-step";
import { initializeCourseStep } from "../steps/initialize-course-step";
import { setCourseAsRunningStep } from "../steps/set-course-as-running-step";
import { streamStatus } from "../stream-status";
import {
  type CourseContext,
  type CourseSuggestionData,
  type ExistingCourseContent,
} from "../types";

export type CourseSetupResult = {
  course: CourseContext;
  existing: ExistingCourseContent;
};

const DEFAULT_EXISTING_CONTENT: ExistingCourseContent = {
  description: null,
  hasAlternativeTitles: false,
  hasCategories: false,
  hasChapters: false,
  imageUrl: null,
};

export async function getOrCreateCourse(
  existingCourse: ExistingCourse | null,
  suggestion: CourseSuggestionData,
  courseSuggestionId: number,
  workflowRunId: string,
): Promise<CourseSetupResult> {
  if (!existingCourse) {
    const course = await initializeCourseStep({ suggestion, workflowRunId });
    await streamStatus({ status: "completed", step: "setCourseAsRunning" });
    return { course, existing: DEFAULT_EXISTING_CONTENT };
  }

  await streamStatus({ status: "completed", step: "initializeCourse" });
  const aiOrg = await getAIOrganizationStep();

  const course: CourseContext = {
    courseId: existingCourse.id,
    courseSlug: existingCourse.slug,
    courseTitle: suggestion.title,
    language: suggestion.language,
    organizationId: aiOrg.id,
  };

  await setCourseAsRunningStep({
    courseId: existingCourse.id,
    courseSuggestionId,
    workflowRunId,
  });

  return {
    course,
    existing: {
      description: existingCourse.description,
      hasAlternativeTitles: existingCourse._count.alternativeTitles > 0,
      hasCategories: existingCourse._count.categories > 0,
      hasChapters: existingCourse._count.chapters > 0,
      imageUrl: existingCourse.imageUrl,
    },
  };
}
