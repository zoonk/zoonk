import { type Chapter } from "@zoonk/db";
import { completeCourseSetupStep } from "../steps/complete-course-setup-step";
import { getCourseChaptersStep } from "../steps/get-course-chapters-step";
import { streamStatus } from "../stream-status";
import { type CourseContext, type ExistingCourseContent } from "../types";
import { generateMissingContent } from "./generate-missing-content";
import { persistGeneratedContent } from "./persist-generated-content";

async function getChapters(
  courseId: number,
  createdChapters: Chapter[],
  hasChapters: boolean,
): Promise<Chapter[]> {
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
): Promise<Chapter[]> {
  const content = await generateMissingContent(course, existing);

  const createdChapters = await persistGeneratedContent(course, content, existing);

  const chapters = await getChapters(course.courseId, createdChapters, existing.hasChapters);

  await completeCourseSetupStep({
    courseId: course.courseId,
    courseSuggestionId,
  });

  return chapters;
}
