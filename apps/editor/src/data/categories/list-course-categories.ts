import "server-only";
import { type CourseCategory, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedListCourseCategories = cache(
  async (courseId: number): Promise<SafeReturn<CourseCategory[]>> => {
    const { data, error } = await safeAsync(() =>
      prisma.courseCategory.findMany({
        orderBy: { category: "asc" },
        where: { courseId },
      }),
    );

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  },
);

export function listCourseCategories(params: {
  courseId: number;
}): Promise<SafeReturn<CourseCategory[]>> {
  return cachedListCourseCategories(params.courseId);
}
