import "server-only";
import { getListedCourseWhere, prisma } from "@zoonk/db";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { cacheTag } from "next/cache";
import { COURSE_LIST_CACHE_TAG } from "../cache/tags";

/**
 * How many courses the catalog lists in one language (`listCourses`), in all and in each
 * category, every category included. A course can sit in several categories, so the total is
 * counted on its own rather than added up.
 */
export async function countCatalogCourses({ language }: { language: string }) {
  "use cache";
  cacheTag(COURSE_LIST_CACHE_TAG);

  const where = getListedCourseWhere({ language });

  const [total, groups] = await Promise.all([
    prisma.course.count({ where }),
    prisma.courseCategory.groupBy({ _count: true, by: ["category"], where: { course: where } }),
  ]);

  const counts = new Map(groups.map((group) => [group.category, group._count]));

  return {
    categories: COURSE_CATEGORIES.map((category) => ({
      category,
      courseCount: counts.get(category) ?? 0,
    })),
    total,
  };
}
