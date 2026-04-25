import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateAlternativeTitles } from "@zoonk/ai/tasks/courses/alternative-titles";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { type CourseContext } from "./initialize-course-step";

export async function generateAlternativeTitlesStep(course: CourseContext): Promise<string[]> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "generateAlternativeTitles" });

  const { data: result, error } = await safeAsync(() =>
    generateAlternativeTitles({
      language: course.language,
      title: course.courseTitle,
    }),
  );

  if (error) {
    throw error;
  }

  await stream.status({
    status: "completed",
    step: "generateAlternativeTitles",
  });

  return result.data.alternatives;
}
