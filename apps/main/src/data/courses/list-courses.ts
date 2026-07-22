import "server-only";
import { COURSE_LIST_CACHE_TAG } from "@/data/cache-tags";
import { getPublishedCourseWhere, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { type CourseCategory } from "@zoonk/utils/categories";
import { cacheTag } from "next/cache";

export const LIST_COURSES_LIMIT = 20;

/**
 * Caches each serializable catalog query as one public result so initial lists,
 * category filters, and cursor pages can share the same application boundary.
 */
export async function listCourses(params: {
  category?: CourseCategory;
  cursor?: string;
  language: string;
  limit?: number;
}) {
  "use cache";
  cacheTag(COURSE_LIST_CACHE_TAG);

  const limit = clampQueryItems(params.limit ?? LIST_COURSES_LIMIT);

  return prisma.course.findMany({
    include: { organization: { select: { slug: true } } },
    orderBy: [{ userCount: "desc" }, { id: "desc" }],
    take: limit,
    ...(params.cursor && { cursor: { id: params.cursor }, skip: 1 }),
    where: getPublishedCourseWhere({
      language: params.language,
      organization: { kind: "brand" },
      ...(params.category && { categories: { some: { category: params.category } } }),
    }),
  });
}

export type CourseWithOrg = Awaited<ReturnType<typeof listCourses>>[number];
