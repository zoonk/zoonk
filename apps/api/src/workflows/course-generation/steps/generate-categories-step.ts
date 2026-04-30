import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateCourseCategories } from "@zoonk/ai/tasks/courses/categories";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type CourseContext } from "./initialize-course-step";

export async function generateCategoriesStep(course: CourseContext): Promise<string[]> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "generateCategories" });

  const result = await generateCourseCategories({ courseTitle: course.courseTitle });

  await stream.status({ status: "completed", step: "generateCategories" });

  return result.data.categories;
}
