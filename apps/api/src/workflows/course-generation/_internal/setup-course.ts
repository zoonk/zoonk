import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { type Chapter } from "@zoonk/db";
import { getCourseChaptersStep } from "../steps/get-course-chapters-step";
import { type CourseContext } from "../steps/initialize-course-step";
import { type ExistingCourseContent } from "./existing-course-content";
import { type GeneratedContent, generateMissingContent } from "./generate-missing-content";
import { persistGeneratedContent } from "./persist-generated-content";

type CourseSetupContentInput = {
  course: CourseContext;
  description: string | null;
  existing: ExistingCourseContent;
};

type PersistCourseSetupContentInput = {
  content: GeneratedContent;
  course: CourseContext;
  existing: ExistingCourseContent;
};

/**
 * Returns the main chapter list the remaining workflow should use. Existing
 * main curriculum rows are loaded from the database; newly generated main
 * curriculum rows can continue directly from the addChapters result.
 */
async function getChapters({
  course,
  createdChapters,
  existing,
}: {
  course: CourseContext;
  createdChapters: Chapter[];
  existing: ExistingCourseContent;
}): Promise<Chapter[]> {
  if (existing.hasMainCurriculum) {
    const chapters = await getCourseChaptersStep(course.courseId);
    return chapters;
  }

  await streamSkipStep("getExistingChapters");
  return createdChapters;
}

/** Starts independent metadata and complete-outline requests together. */
async function generateCourseSetupContent({
  course,
  description,
  existing,
}: CourseSetupContentInput): Promise<GeneratedContent> {
  return generateMissingContent({ course, description, existing });
}

/** Installs the full outline after revision-guarded metadata writes have settled. */
async function persistCourseSetupContent({
  content,
  course,
  existing,
}: PersistCourseSetupContentInput): Promise<Chapter[]> {
  const chapters = await persistGeneratedContent(course, content, existing);

  return getChapters({ course, createdChapters: chapters, existing });
}

/**
 * Builds and persists the course-level content needed before lesson generation
 * starts. The setup phase returns the chapter list because the next workflow
 * phase uses it to generate chapter images. Lesson generation remains explicit.
 */
export async function setupCourse(
  course: CourseContext,
  description: string | null,
  existing: ExistingCourseContent,
): Promise<Chapter[]> {
  const content = await generateCourseSetupContent({ course, description, existing });

  return persistCourseSetupContent({ content, course, existing });
}
