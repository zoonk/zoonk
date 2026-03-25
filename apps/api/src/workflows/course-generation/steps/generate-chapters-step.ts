import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@/workflows/config";
import { type CourseChapter, generateCourseChapters } from "@zoonk/ai/tasks/courses/chapters";
import { generateLanguageCourseChapters } from "@zoonk/ai/tasks/courses/language-chapters";
import { safeAsync } from "@zoonk/utils/error";
import { type CourseContext } from "./initialize-course-step";

function generateChapters(course: CourseContext) {
  if (course.targetLanguage) {
    return generateLanguageCourseChapters({
      targetLanguage: course.targetLanguage,
      userLanguage: course.language,
    });
  }

  return generateCourseChapters({
    courseTitle: course.courseTitle,
    language: course.language,
  });
}

export async function generateChaptersStep(course: CourseContext): Promise<CourseChapter[]> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "generateChapters" });

  const { data: result, error } = await safeAsync(() => generateChapters(course));

  if (error) {
    await stream.error({ reason: "aiGenerationFailed", step: "generateChapters" });
    throw error;
  }

  await stream.status({ status: "completed", step: "generateChapters" });

  return result.data.chapters;
}
