import "server-only";

import { prisma } from "@zoonk/db";

export async function addCourseCategories(params: {
  courseId: number;
  categories: string[];
}): Promise<void> {
  const uniqueCategories = [...new Set(params.categories)].filter(Boolean);

  if (uniqueCategories.length === 0) {
    return;
  }

  await prisma.courseCategory.createMany({
    data: uniqueCategories.map((category) => ({
      category,
      courseId: params.courseId,
    })),
    skipDuplicates: true,
  });
}
