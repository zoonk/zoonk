import { generateCourseCategories } from "@zoonk/ai/course-categories/generate";

type Input = { courseTitle: string };

export async function generateCategoriesStep(input: Input): Promise<string[]> {
  "use step";

  const { data } = await generateCourseCategories({
    courseTitle: input.courseTitle,
  });

  return data.categories;
}
