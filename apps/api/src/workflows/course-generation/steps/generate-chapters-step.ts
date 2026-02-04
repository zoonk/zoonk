import { generateCourseChapters } from "@zoonk/ai/tasks/courses/chapters";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type CourseContext, type GeneratedChapter } from "../types";

export async function generateChaptersStep(course: CourseContext): Promise<GeneratedChapter[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateChapters" });

  const { data: result, error } = await safeAsync(() =>
    generateCourseChapters({
      courseTitle: course.courseTitle,
      language: course.language,
    }),
  );

  if (error) {
    await streamStatus({ status: "error", step: "generateChapters" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateChapters" });

  return result.data.chapters;
}
