import "server-only";
import { type CourseCategory, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedListCourseCategories = cache(
  async (
    courseSlug: string,
    language: string,
    orgSlug: string,
  ): Promise<SafeReturn<CourseCategory[]>> => {
    const { data, error } = await safeAsync(() =>
      prisma.courseCategory.findMany({
        orderBy: { category: "asc" },
        where: {
          course: {
            language,
            organization: { slug: orgSlug },
            slug: courseSlug,
          },
        },
      }),
    );

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  },
);

export function listCourseCategories(params: {
  courseSlug: string;
  language: string;
  orgSlug: string;
}): Promise<SafeReturn<CourseCategory[]>> {
  return cachedListCourseCategories(params.courseSlug, params.language, params.orgSlug);
}
