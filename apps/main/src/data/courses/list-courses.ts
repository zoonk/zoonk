import "server-only";
import { getPublishedCourseWhere, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { type CourseCategory } from "@zoonk/utils/categories";
import { cache } from "react";

export const LIST_COURSES_LIMIT = 20;

const cachedListCourses = cache(
  async (language: string, limit: number, category?: CourseCategory, cursor?: string) => {
    const courses = await prisma.course.findMany({
      include: {
        organization: {
          select: { slug: true },
        },
      },
      orderBy: [{ userCount: "desc" }, { id: "desc" }],
      take: limit,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      where: getPublishedCourseWhere({
        language,
        organization: { kind: "brand" },
        ...(category && {
          categories: { some: { category } },
        }),
      }),
    });

    return courses;
  },
);

export type CourseWithOrg = Awaited<ReturnType<typeof cachedListCourses>>[number];

export function listCourses(params: {
  category?: CourseCategory;
  cursor?: string;
  language: string;
  limit?: number;
}): Promise<CourseWithOrg[]> {
  const limit = clampQueryItems(params.limit ?? LIST_COURSES_LIMIT);
  return cachedListCourses(params.language, limit, params.category, params.cursor);
}
