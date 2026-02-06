import { completeCourseSetupStep } from "../steps/complete-course-setup-step";
import { getCourseChaptersStep } from "../steps/get-course-chapters-step";
import { streamStatus } from "../stream-status";
import { type CourseContext, type CreatedChapter, type ExistingCourseContent } from "../types";
import { generateMissingContent } from "./generate-missing-content";
import { persistGeneratedContent } from "./persist-generated-content";

async function getChapters(
  courseId: number,
  createdChapters: CreatedChapter[],
  hasChapters: boolean,
): Promise<CreatedChapter[]> {
  if (hasChapters) {
    return getCourseChaptersStep(courseId);
  }

  await streamStatus({ status: "completed", step: "getExistingChapters" });
  return createdChapters;
}

export async function setupCourse(
  course: CourseContext,
  courseSuggestionId: number,
  existing: ExistingCourseContent,
): Promise<CreatedChapter[]> {
  const content = await generateMissingContent(course, existing);

  const createdChapters = await persistGeneratedContent(course, content, existing);

  const chapters = await getChapters(course.courseId, createdChapters, existing.hasChapters);

  await completeCourseSetupStep({
    courseId: course.courseId,
    courseSuggestionId,
  });

  return chapters;
}
