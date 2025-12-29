import "server-only";

import { type Course, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import type { CourseCategory } from "@zoonk/utils/categories";
import { cache } from "react";

export const LIST_COURSES_LIMIT = 20;

export const listCourses = cache(
  async (params: {
    category?: CourseCategory;
    cursor?: number;
    language: string;
    limit?: number;
  }): Promise<Course[]> => {
    const limit = clampQueryItems(params.limit ?? LIST_COURSES_LIMIT);

    const courses = await prisma.course.findMany({
      // biome-ignore lint/style/useNamingConvention: _count is Prisma's syntax for counting relations
      orderBy: [{ users: { _count: "desc" } }, { createdAt: "desc" }],
      take: limit,
      ...(params.cursor && {
        cursor: { id: params.cursor },
        skip: 1,
      }),
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
