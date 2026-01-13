import { generateCourseCategories } from "@zoonk/ai/course-categories/generate";
import { streamStatus } from "../stream-status";
import type { CourseContext } from "../types";

export async function generateCategoriesStep(
  course: CourseContext,
): Promise<string[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateCategories" });

  const { data } = await generateCourseCategories({
    courseTitle: course.courseTitle,
  });

  await streamStatus({ status: "completed", step: "generateCategories" });

  return data.categories;
}
