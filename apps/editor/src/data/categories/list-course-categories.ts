import "server-only";

import { type CourseCategory, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function listCourseCategories(params: {
  courseId: number;
}): Promise<SafeReturn<CourseCategory[]>> {
  const { data, error } = await safeAsync(() =>
    prisma.courseCategory.findMany({
      orderBy: { category: "asc" },
      where: { courseId: params.courseId },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
