import { FatalError, getWorkflowMetadata } from "workflow";
import type { ExistingCourse } from "@/data/courses/find-existing-course";
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
import { getAIOrganizationStep } from "./steps/get-ai-organization-step";
import { getCourseChaptersStep } from "./steps/get-course-chapters-step";
import { getCourseSuggestionStep } from "./steps/get-course-suggestion-step";
import { handleCourseFailureStep } from "./steps/handle-failure-step";
import { initializeCourseStep } from "./steps/initialize-course-step";
import { setCourseAsRunningStep } from "./steps/set-course-as-running-step";
import { startChapterGenerationStep } from "./steps/start-chapter-generation-step";
import { updateCourseStep } from "./steps/update-course-step";
import type {
  CourseContext,
  CourseSuggestionData,
  CreatedChapter,
  ExistingCourseContent,
  GeneratedChapter,
} from "./types";

type GeneratedContent = {
  description: string;
  imageUrl: string;
  alternativeTitles: string[];
  categories: string[];
  chapters: GeneratedChapter[];
};

async function generateMissingContent(
  course: CourseContext,
  existing: ExistingCourseContent,
): Promise<GeneratedContent> {
  const [
    generatedDescription,
    generatedImageUrl,
    alternativeTitles,
    categories,
    chapters,
  ] = await Promise.all([
    existing.description ? null : generateDescriptionStep(course),
    existing.imageUrl ? null : generateImageStep(course),
    existing.hasAlternativeTitles ? [] : generateAlternativeTitlesStep(course),
    existing.hasCategories ? [] : generateCategoriesStep(course),
    existing.hasChapters ? [] : generateChaptersStep(course),
  ]);

  const description = existing.description ?? generatedDescription ?? "";
  const imageUrl = existing.imageUrl ?? generatedImageUrl ?? "";

  return { alternativeTitles, categories, chapters, description, imageUrl };
}

async function persistGeneratedContent(
  course: CourseContext,
  content: GeneratedContent,
  existing: ExistingCourseContent,
): Promise<CreatedChapter[]> {
  const needsCourseUpdate = !(existing.description && existing.imageUrl);
  const needsAlternativeTitles =
    !existing.hasAlternativeTitles && content.alternativeTitles.length > 0;
  const needsCategories =
    !existing.hasCategories && content.categories.length > 0;
  const needsChapters = !existing.hasChapters && content.chapters.length > 0;

  const metadataOps = [
    needsCourseUpdate &&
      updateCourseStep({
        course,
        description: content.description,
        imageUrl: content.imageUrl,
      }),
    needsAlternativeTitles &&
      addAlternativeTitlesStep({
        alternativeTitles: content.alternativeTitles,
        course,
      }),
    needsCategories &&
      addCategoriesStep({ categories: content.categories, course }),
  ].filter(Boolean);

  const [chapters] = await Promise.all([
    needsChapters
      ? addChaptersStep({ chapters: content.chapters, course })
      : Promise.resolve<CreatedChapter[]>([]),
    ...metadataOps,
  ]);

  return chapters;
}

async function getChaptersForCourse(
  courseId: number,
  existing: ExistingCourseContent,
  createdChapters: CreatedChapter[],
): Promise<CreatedChapter[]> {
  if (!existing.hasChapters) {
    return createdChapters;
  }

  return getCourseChaptersStep(courseId);
}

async function setupCourse(
  course: CourseContext,
  courseSuggestionId: number,
  existing: ExistingCourseContent,
): Promise<CreatedChapter[]> {
  const content = await generateMissingContent(course, existing);
  const createdChapters = await persistGeneratedContent(
    course,
    content,
    existing,
  );
  const chapters = await getChaptersForCourse(
    course.courseId,
    existing,
    createdChapters,
  );

  await completeCourseSetupStep({
    courseId: course.courseId,
    courseSuggestionId,
  });

  return chapters;
}

type CourseSetupResult = {
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

function buildExistingContent(
  existingCourse: ExistingCourse,
): ExistingCourseContent {
  return {
    description: existingCourse.description,
    hasAlternativeTitles: existingCourse._count.alternativeTitles > 0,
    hasCategories: existingCourse._count.categories > 0,
    hasChapters: existingCourse._count.chapters > 0,
    imageUrl: existingCourse.imageUrl,
  };
}

async function resumeExistingCourse(
  existingCourse: ExistingCourse,
  suggestion: CourseSuggestionData,
  courseSuggestionId: number,
  workflowRunId: string,
): Promise<CourseSetupResult> {
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
    existing: buildExistingContent(existingCourse),
  };
}

async function createNewCourse(
  suggestion: CourseSuggestionData,
  workflowRunId: string,
): Promise<CourseSetupResult> {
  const course = await initializeCourseStep({ suggestion, workflowRunId });

  return {
    course,
    existing: DEFAULT_EXISTING_CONTENT,
  };
}

async function getOrCreateCourse(
  existingCourse: ExistingCourse | null,
  suggestion: CourseSuggestionData,
  courseSuggestionId: number,
  workflowRunId: string,
): Promise<CourseSetupResult> {
  if (existingCourse) {
    return resumeExistingCourse(
      existingCourse,
      suggestion,
      courseSuggestionId,
      workflowRunId,
    );
  }

  return createNewCourse(suggestion, workflowRunId);
}

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

  const chapters = await setupCourse(
    course,
    courseSuggestionId,
    existing,
  ).catch(async (error) => {
    await handleCourseFailureStep({
      courseId: course.courseId,
      courseSuggestionId,
    });

    console.error(
      `[workflow ${workflowRunId}] Course generation failed`,
      error,
    );

    throw FatalError;
  });

  // Start chapter generation outside the course error handling.
  // Chapter generation has its own error handling that marks the chapter as failed.
  // We don't want chapter failures to mark the entire course as failed.
  const firstChapter = chapters[0];

  if (firstChapter) {
    await startChapterGenerationStep(firstChapter);
  }
}
