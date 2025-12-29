import "server-only";

import { type Course, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import type { CourseCategory } from "@zoonk/utils/categories";
import { cache } from "react";

const LIST_COURSES_LIMIT = 20;

export const listCourses = cache(
  async (params: {
    category?: CourseCategory;
    language: string;
    limit?: number;
  }): Promise<Course[]> => {
    const courses = await prisma.course.findMany({
      // biome-ignore lint/style/useNamingConvention: _count is Prisma's syntax for counting relations
      orderBy: [{ users: { _count: "desc" } }, { createdAt: "desc" }],
      take: clampQueryItems(params.limit ?? LIST_COURSES_LIMIT),
      where: {
        isPublished: true,
        language: params.language,
        organization: { kind: "brand" },
        ...(params.category && {
          categories: { some: { category: params.category } },
        }),
      },
    });

    return courses;
  },
);
