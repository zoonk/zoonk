import "server-only";
import { getListedCourseWhere, prisma } from "@zoonk/db";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { cacheTag } from "next/cache";
import { COURSE_LIST_CACHE_TAG } from "../cache/tags";

/** Courses can have multiple categories, so their total must not be the sum of category counts. */
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
