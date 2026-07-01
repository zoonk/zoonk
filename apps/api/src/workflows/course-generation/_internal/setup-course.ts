import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { type Chapter } from "@zoonk/db";
import { getCourseChaptersStep } from "../steps/get-course-chapters-step";
import { type CourseContext } from "../steps/initialize-course-step";
import { type ExistingCourseContent } from "./existing-course-content";
import { generateMissingContent } from "./generate-missing-content";
import { persistGeneratedContent } from "./persist-generated-content";

/**
 * Returns the chapter list the remaining workflow should use. Existing courses
 * keep their saved chapter rows; newly generated courses continue with the
 * chapters that were just created.
 */
async function getChapters({
  courseId,
  createdChapters,
  hasChapters,
}: {
  courseId: string;
  createdChapters: Chapter[];
  hasChapters: boolean;
}): Promise<Chapter[]> {
  if (hasChapters) {
    return getCourseChaptersStep(courseId);
  }

  await streamSkipStep("getExistingChapters");
  return createdChapters;
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
  const content = await generateMissingContent({ course, description, existing });
  const createdChapters = await persistGeneratedContent(course, content, existing);

  return getChapters({
    courseId: course.courseId,
    createdChapters,
    hasChapters: existing.hasChapters,
  });
}
