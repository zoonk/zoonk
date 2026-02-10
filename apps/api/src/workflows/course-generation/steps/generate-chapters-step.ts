import { generateCourseChapters } from "@zoonk/ai/tasks/courses/chapters";
import { generateLanguageCourseChapters } from "@zoonk/ai/tasks/courses/language-chapters";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { type CourseContext, type GeneratedChapter } from "../types";

function generateChapters(course: CourseContext) {
  if (course.targetLanguage) {
    return generateLanguageCourseChapters({
      courseTitle: course.courseTitle,
      language: course.language,
      targetLanguage: course.targetLanguage,
    });
  }

  return generateCourseChapters({
    courseTitle: course.courseTitle,
    language: course.language,
  });
}

export async function generateChaptersStep(course: CourseContext): Promise<GeneratedChapter[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateChapters" });

  const { data: result, error } = await safeAsync(() => generateChapters(course));

  if (error) {
    await streamError({ reason: "aiGenerationFailed", step: "generateChapters" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateChapters" });

  return result.data.chapters;
}
