import "server-only";

import { type CourseCategory, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export const listCourseCategories = cache(
  async (params: {
    courseSlug: string;
    language: string;
    orgSlug: string;
  }): Promise<SafeReturn<CourseCategory[]>> => {
    const { data, error } = await safeAsync(() =>
      prisma.courseCategory.findMany({
        orderBy: { category: "asc" },
        where: {
          course: {
            language: params.language,
            organization: { slug: params.orgSlug },
            slug: params.courseSlug,
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
