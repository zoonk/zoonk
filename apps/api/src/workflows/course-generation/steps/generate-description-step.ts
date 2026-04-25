import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateCourseDescription } from "@zoonk/ai/tasks/courses/description";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { type CourseContext } from "./initialize-course-step";

export async function generateDescriptionStep(course: CourseContext): Promise<string> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "generateDescription" });

  const { data: result, error } = await safeAsync(() =>
    generateCourseDescription({
      language: course.language,
      title: course.courseTitle,
    }),
  );

  if (error) {
    throw error;
  }

  await stream.status({ status: "completed", step: "generateDescription" });

  return result.data.description;
}
