import { FatalError, getWorkflowMetadata } from "workflow";
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
  let chapters: CreatedChapter[] = [];

  const persistPromises: Promise<unknown>[] = [];

  const needsCourseUpdate = !(existing.description && existing.imageUrl);
  if (needsCourseUpdate) {
    persistPromises.push(
      updateCourseStep({
        course,
        description: content.description,
        imageUrl: content.imageUrl,
      }),
    );
  }

  if (!existing.hasAlternativeTitles && content.alternativeTitles.length > 0) {
    persistPromises.push(
      addAlternativeTitlesStep({
        alternativeTitles: content.alternativeTitles,
        course,
      }),
    );
  }

  if (!existing.hasCategories && content.categories.length > 0) {
    persistPromises.push(
      addCategoriesStep({ categories: content.categories, course }),
    );
  }

  if (!existing.hasChapters && content.chapters.length > 0) {
    persistPromises.push(
      addChaptersStep({ chapters: content.chapters, course }).then((ch) => {
        chapters = ch;
      }),
    );
  }

  await Promise.all(persistPromises);

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

  let course: CourseContext;
  let existing: ExistingCourseContent = {
    description: null,
    hasAlternativeTitles: false,
    hasCategories: false,
    hasChapters: false,
    imageUrl: null,
  };

  if (existingCourse) {
    // Resume existing course (failed or pending)
    const aiOrg = await getAIOrganizationStep();

    course = {
      courseId: existingCourse.id,
      courseSlug: existingCourse.slug,
      courseTitle: suggestion.title,
      language: suggestion.language,
      organizationId: aiOrg.id,
    };

    existing = {
      description: existingCourse.description,
      hasAlternativeTitles: existingCourse._count.alternativeTitles > 0,
      hasCategories: existingCourse._count.categories > 0,
      hasChapters: existingCourse._count.chapters > 0,
      imageUrl: existingCourse.imageUrl,
    };

    await setCourseAsRunningStep({
      courseId: existingCourse.id,
      courseSuggestionId,
      workflowRunId,
    });
  } else {
    // Create new course
    course = await initializeCourseStep({
      suggestion,
      workflowRunId,
    });
  }

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
