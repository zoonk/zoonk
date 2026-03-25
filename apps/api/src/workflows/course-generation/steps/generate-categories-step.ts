import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@/workflows/config";
import { generateCourseCategories } from "@zoonk/ai/tasks/courses/categories";
import { safeAsync } from "@zoonk/utils/error";
import { type CourseContext } from "./initialize-course-step";

export async function generateCategoriesStep(course: CourseContext): Promise<string[]> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "generateCategories" });

  const { data: result, error } = await safeAsync(() =>
    generateCourseCategories({
      courseTitle: course.courseTitle,
    }),
  );

  if (error) {
    await stream.error({ reason: "aiGenerationFailed", step: "generateCategories" });
    throw error;
  }

  await stream.status({ status: "completed", step: "generateCategories" });

  return result.data.categories;
}
