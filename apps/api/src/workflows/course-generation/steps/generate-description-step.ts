import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateCourseDescription } from "@zoonk/ai/tasks/courses/description";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type CourseContext } from "./initialize-course-step";

export async function generateDescriptionStep(course: CourseContext): Promise<string> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "generateDescription" });

  const result = await generateCourseDescription({
    language: course.language,
    title: course.courseTitle,
  });

  await stream.status({ status: "completed", step: "generateDescription" });

  return result.data.description;
}
