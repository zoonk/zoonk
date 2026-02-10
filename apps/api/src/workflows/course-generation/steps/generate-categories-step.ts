import { generateCourseCategories } from "@zoonk/ai/tasks/courses/categories";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { type CourseContext } from "../types";

export async function generateCategoriesStep(course: CourseContext): Promise<string[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateCategories" });

  const { data: result, error } = await safeAsync(() =>
    generateCourseCategories({
      courseTitle: course.courseTitle,
    }),
  );

  if (error) {
    await streamError({ reason: "aiGenerationFailed", step: "generateCategories" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateCategories" });

  return result.data.categories;
}
