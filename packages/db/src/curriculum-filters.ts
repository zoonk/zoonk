import { type Course, type Prisma } from "./generated/prisma/client";

/**
 * A course is published once its outline is written: it has a public page from then on. Keeping
 * the predicate here gives every course read one definition of "published".
 */
export function getPublishedCourseWhere(
  where: Prisma.CourseWhereInput = {},
): Prisma.CourseWhereInput {
  return { ...where, isPublished: true };
}

/**
 * The course a public course URL names: a published brand course with that brand and course slug.
 * The course page and the check that answers its missing URLs with a 404 share it.
 */
export function getCourseRouteWhere({
  brandSlug,
  courseSlug,
}: {
  brandSlug: string;
  courseSlug: string;
}): Prisma.CourseWhereInput {
  return getPublishedCourseWhere({
    organization: { kind: "brand", slug: brandSlug },
    slug: courseSlug,
  });
}

/**
 * The catalog, search, sitemaps and search engines only get a course once it's whole: a shared
 * brand course (never a learner's private one), published and with its page details written. A
 * shared course made for a guest's goal is published before its details, which wait for a learner
 * with an account, so until then only the learners studying it reach its page.
 */
export function getListedCourseWhere(where: Prisma.CourseWhereInput = {}): Prisma.CourseWhereInput {
  return getPublishedCourseWhere({
    ...where,
    description: { not: null },
    organization: { kind: "brand" },
    visibility: "public",
  });
}

/**
 * `getListedCourseWhere` for a course already loaded from a brand, such as a public course page
 * deciding whether search engines may index it.
 */
export function isListedCourse(
  course: Pick<Course, "description" | "isPublished" | "visibility">,
): boolean {
  return course.isPublished && course.visibility === "public" && course.description !== null;
}
