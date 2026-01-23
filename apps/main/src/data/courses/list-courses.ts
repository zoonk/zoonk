import "server-only";
import { type Course, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { cache } from "react";
import type { CourseCategory } from "@zoonk/utils/categories";

export const LIST_COURSES_LIMIT = 20;

export type CourseWithOrg = Course & {
  organization: { slug: string };
};

const cachedListCourses = cache(
  async (
    language: string,
    limit: number,
    category?: CourseCategory,
    cursor?: number,
  ): Promise<CourseWithOrg[]> => {
    const courses = await prisma.course.findMany({
      include: {
        organization: {
          select: { slug: true },
        },
      },
      orderBy: [{ users: { _count: "desc" } }, { createdAt: "desc" }],
      take: limit,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      where: {
        isPublished: true,
        language,
        organization: { kind: "brand" },
        ...(category && {
          categories: { some: { category } },
        }),
      },
    });

    return courses;
  },
);

export function listCourses(params: {
  category?: CourseCategory;
  cursor?: number;
  language: string;
  limit?: number;
}): Promise<CourseWithOrg[]> {
  const limit = clampQueryItems(params.limit ?? LIST_COURSES_LIMIT);
  return cachedListCourses(params.language, limit, params.category, params.cursor);
}
