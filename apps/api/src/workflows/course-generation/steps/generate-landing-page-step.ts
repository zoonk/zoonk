import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseChapter } from "@zoonk/ai/tasks/courses/chapters";
import {
  type CourseLandingPageSchema,
  generateCourseLandingPage,
} from "@zoonk/ai/tasks/courses/landing-page";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type CourseContext } from "./initialize-course-step";

/**
 * Wraps the AI landing-copy task in a workflow step so course generation can
 * stream progress and retry/fail this copy at the same boundary as the other
 * course-level metadata.
 */
export async function generateLandingPageStep({
  chapters,
  course,
  description,
}: {
  chapters: CourseChapter[];
  course: CourseContext;
  description: string;
}): Promise<CourseLandingPageSchema> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "generateLandingPage" });

  const result = await generateCourseLandingPage({
    chapters,
    description,
    language: course.language,
    targetLanguage: course.targetLanguage,
    title: course.courseTitle,
  });

  await stream.status({ status: "completed", step: "generateLandingPage" });

  return result.data;
}
