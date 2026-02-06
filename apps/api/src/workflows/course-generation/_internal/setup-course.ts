import { completeCourseSetupStep } from "../steps/complete-course-setup-step";
import { getCourseChaptersStep } from "../steps/get-course-chapters-step";
import { streamStatus } from "../stream-status";
import { type CourseContext, type CreatedChapter, type ExistingCourseContent } from "../types";
import { generateMissingContent } from "./generate-missing-content";
import { persistGeneratedContent } from "./persist-generated-content";

export async function setupCourse(
  course: CourseContext,
  courseSuggestionId: number,
  existing: ExistingCourseContent,
): Promise<CreatedChapter[]> {
  const content = await generateMissingContent(course, existing);

  const createdChapters = await persistGeneratedContent(course, content, existing);

  let chapters: CreatedChapter[];

  if (existing.hasChapters) {
    chapters = await getCourseChaptersStep(course.courseId);
  } else {
    await streamStatus({ status: "completed", step: "getExistingChapters" });
    chapters = createdChapters;
  }

  await completeCourseSetupStep({
    courseId: course.courseId,
    courseSuggestionId,
  });

  return chapters;
}
