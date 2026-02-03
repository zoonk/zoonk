import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type CourseContext } from "../types";

export async function addCategoriesStep(input: {
  course: CourseContext;
  categories: string[];
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "addCategories" });

  const categories = input.categories.map((category) => ({
    category,
    courseId: input.course.courseId,
  }));

  const { error } = await safeAsync(() =>
    prisma.courseCategory.createMany({
      data: categories,
      skipDuplicates: true,
    }),
  );

  if (error) {
    await streamStatus({ status: "error", step: "addCategories" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "addCategories" });
}
