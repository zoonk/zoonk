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
 * Keeps regular-course intro chapters out of the parent chapter-generation
 * phase. Intro lessons are started by the intro setup branch, while the parent
 * workflow should continue with the main curriculum chapters only.
 */
function getGeneratableChapters({
  chapters,
  targetLanguage,
}: {
  chapters: Chapter[];
  targetLanguage: string | null;
}): Chapter[] {
  if (targetLanguage) {
    return chapters;
  }

  return chapters.filter((chapter) => chapter.position > 0);
}

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
    return getGeneratableChapters({ chapters, targetLanguage: course.targetLanguage });
  }

  await streamSkipStep("getExistingChapters");
  return createdChapters;
}

/**
 * Starts the expensive course-level AI work without requiring the caller to
 * persist the result immediately. Regular courses use this split so description,
 * thumbnail, categories, and chapter outline generation can run while the intro
 * chapter is being prepared.
 */
async function generateCourseSetupContent({
  course,
  description,
  existing,
}: CourseSetupContentInput): Promise<GeneratedContent> {
  return generateMissingContent({ course, description, existing });
}

/**
 * Persists generated course content after any prerequisite chapter shells exist.
 * This keeps the generated curriculum append offset based on the current saved
 * course state, not on a stale snapshot from before the intro chapter was added.
 */
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
 * phase uses it to generate lessons and images.
 */
export async function setupCourse(
  course: CourseContext,
  description: string | null,
  existing: ExistingCourseContent,
): Promise<Chapter[]> {
  const content = await generateCourseSetupContent({ course, description, existing });

  return persistCourseSetupContent({ content, course, existing });
}
