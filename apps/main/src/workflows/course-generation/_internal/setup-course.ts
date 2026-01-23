import { completeCourseSetupStep } from "../steps/complete-course-setup-step";
import { getCourseChaptersStep } from "../steps/get-course-chapters-step";
import type {
  CourseContext,
  CreatedChapter,
  ExistingCourseContent,
} from "../types";
import { generateMissingContent } from "./generate-missing-content";
import { persistGeneratedContent } from "./persist-generated-content";

export async function setupCourse(
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

  const chapters = existing.hasChapters
    ? await getCourseChaptersStep(course.courseId)
    : createdChapters;

  await completeCourseSetupStep({
    courseId: course.courseId,
    courseSuggestionId,
  });

  return chapters;
}
