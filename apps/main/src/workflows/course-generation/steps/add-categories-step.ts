import { addCourseCategories } from "@/data/courses/add-course-categories";

import { streamStatus } from "../stream-status";

type Input = { courseId: number; categories: string[] };

export async function addCategoriesStep(input: Input): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "addCategories" });

  await addCourseCategories({
    categories: input.categories,
    courseId: input.courseId,
  });

  await streamStatus({ status: "completed", step: "addCategories" });
}
