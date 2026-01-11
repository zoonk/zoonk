import "server-only";

import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";

export async function addCourseCategories(params: {
  courseId: number;
  categories: string[];
}): Promise<void> {
  const uniqueCategories = [...new Set(params.categories)].filter(Boolean);

  if (uniqueCategories.length === 0) {
    return;
  }

  const course = await prisma.course.findUnique({
    select: { organization: { select: { slug: true } } },
    where: { id: params.courseId },
  });

  if (course?.organization.slug !== AI_ORG_SLUG) {
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
