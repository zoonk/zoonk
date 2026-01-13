import "server-only";

import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

type AddParams = {
  courseId: number;
  categories: string[];
};

export async function addCourseCategories(
  params: AddParams,
): Promise<SafeReturn<void>> {
  const data = params.categories.map((category) => ({
    category,
    courseId: params.courseId,
  }));

  const { error } = await safeAsync(() =>
    prisma.courseCategory.createMany({
      data,
      skipDuplicates: true,
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: undefined, error: null };
}
