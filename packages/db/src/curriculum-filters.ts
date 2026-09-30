import { type Prisma } from "./generated/prisma/client";

/**
 * Public course reads only list published courses. Keeping the predicate here
 * lets the catalog list and search share one definition of "published".
 */
export function getPublishedCourseWhere(
  where: Prisma.CourseWhereInput = {},
): Prisma.CourseWhereInput {
  return { ...where, isPublished: true };
}
