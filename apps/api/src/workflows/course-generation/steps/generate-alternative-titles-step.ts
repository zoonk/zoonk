import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateAlternativeTitles } from "@zoonk/ai/tasks/courses/alternative-titles";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type CourseContext } from "./initialize-course-step";

export async function generateAlternativeTitlesStep(course: CourseContext): Promise<string[]> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "generateAlternativeTitles" });

  const result = await generateAlternativeTitles({
    language: course.language,
    title: course.courseTitle,
  });

  await stream.status({ status: "completed", step: "generateAlternativeTitles" });

  return result.data.alternatives;
}
