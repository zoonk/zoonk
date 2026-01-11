import { addCourseCategories } from "@/data/courses/add-course-categories";

type Input = { courseId: number; categories: string[] };

export async function addCategoriesStep(input: Input): Promise<void> {
  "use step";

  await addCourseCategories({
    categories: input.categories,
    courseId: input.courseId,
  });
}
