import { generateCourseCategories } from "@zoonk/ai/course-categories/generate";

export async function stepGenerateCourseCategories(params: {
  courseTitle: string;
}) {
  "use step";

  const { data } = await generateCourseCategories({
    courseTitle: params.courseTitle,
  });

  return { data: data.categories };
}
