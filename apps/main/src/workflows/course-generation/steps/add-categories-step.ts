import { addCourseCategories } from "@/data/courses/add-course-categories";
import { streamStatus } from "../stream-status";
import { type CourseContext } from "../types";

type AddInput = {
  course: CourseContext;
  categories: string[];
};

export async function addCategoriesStep(input: AddInput): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "addCategories" });

  const { error } = await addCourseCategories({
    categories: input.categories,
    courseId: input.course.courseId,
  });

  if (error) {
    await streamStatus({ status: "error", step: "addCategories" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "addCategories" });
}
