import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { type CourseSuggestion } from "@zoonk/db";
import { getAIOrganizationStep } from "../steps/get-ai-organization-step";
import { type CourseContext, initializeCourseStep } from "../steps/initialize-course-step";
import { type ExistingCourse } from "../steps/resolve-course-identity-step";
import { setCourseAsRunningStep } from "../steps/set-course-as-running-step";

export type ExistingCourseContent = {
  description: string | null;
  imageUrl: string | null;
  hasCategories: boolean;
  hasChapters: boolean;
};

const DEFAULT_EXISTING_CONTENT: ExistingCourseContent = {
  description: null,
  hasCategories: false,
  hasChapters: false,
  imageUrl: null,
};

export async function getOrCreateCourse(
  existingCourse: ExistingCourse | null,
  suggestion: CourseSuggestion,
  courseSuggestionId: string,
  workflowRunId: string,
): Promise<{ course: CourseContext; existing: ExistingCourseContent }> {
  if (!existingCourse) {
    const course = await initializeCourseStep({ suggestion, workflowRunId });
    await streamSkipStep("setCourseAsRunning");
    return { course, existing: DEFAULT_EXISTING_CONTENT };
  }

  await streamSkipStep("initializeCourse");
  const aiOrg = await getAIOrganizationStep();

  const course: CourseContext = {
    courseId: existingCourse.id,
    courseSlug: existingCourse.slug,
    courseTitle: suggestion.title,
    language: suggestion.language,
    organizationId: aiOrg.id,
    targetLanguage: suggestion.targetLanguage,
  };

  await setCourseAsRunningStep({ courseId: existingCourse.id, courseSuggestionId, workflowRunId });

  return {
    course,
    existing: {
      description: existingCourse.description,
      hasCategories: existingCourse._count.categories > 0,
      hasChapters: existingCourse._count.chapters > 0,
      imageUrl: existingCourse.imageUrl,
    },
  };
}
