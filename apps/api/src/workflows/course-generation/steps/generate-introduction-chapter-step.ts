import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  type CourseIntroductionSchema,
  generateCourseIntroduction,
} from "@zoonk/ai/tasks/courses/introduction";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type CourseContext } from "./initialize-course-step";

/**
 * Generates the fixed first chapter separately from the full curriculum
 * outline. This keeps the learner-facing introduction focused on a friendly
 * field guide instead of forcing the normal chapter-lessons task to serve two
 * different goals.
 */
export async function generateIntroductionChapterStep(
  course: CourseContext & { targetLanguage: null },
): Promise<CourseIntroductionSchema> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();
  await stream.status({ status: "started", step: "generateIntroductionChapter" });

  const result = await generateCourseIntroduction({
    courseTitle: course.courseTitle,
    language: course.language,
  });

  await stream.status({ status: "completed", step: "generateIntroductionChapter" });

  return result.data;
}
