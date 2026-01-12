import { generateCourseCategories } from "@zoonk/ai/course-categories/generate";

import { streamStatus } from "../stream-status";

type Input = { courseTitle: string };

export async function generateCategoriesStep(input: Input): Promise<string[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateCategories" });

  const { data } = await generateCourseCategories({
    courseTitle: input.courseTitle,
  });

  await streamStatus({ status: "completed", step: "generateCategories" });

  return data.categories;
}
