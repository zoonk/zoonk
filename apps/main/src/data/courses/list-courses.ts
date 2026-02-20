import "server-only";
import { type Course, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { type CourseCategory } from "@zoonk/utils/categories";
import { cache } from "react";

export const LIST_COURSES_LIMIT = 20;

export type CourseWithOrg = Course & {
  organization: { slug: string } | null;
};

const cachedListCourses = cache(
  async (
    language: string,
    limit: number,
    category?: CourseCategory,
    offset?: number,
  ): Promise<CourseWithOrg[]> => {
    const courses = await prisma.course.findMany({
      include: {
        organization: {
          select: { slug: true },
        },
      },
      orderBy: [{ users: { _count: "desc" } }, { createdAt: "desc" }],
      take: limit,
      ...(offset && { skip: offset }),
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
  language: string;
  limit?: number;
  offset?: number;
}): Promise<CourseWithOrg[]> {
  const limit = clampQueryItems(params.limit ?? LIST_COURSES_LIMIT);
  return cachedListCourses(params.language, limit, params.category, params.offset);
}
