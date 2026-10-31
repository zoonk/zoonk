import { type Course, type Prisma } from "./generated/prisma/client";

export function getPublishedCourseWhere(
  where: Prisma.CourseWhereInput = {},
): Prisma.CourseWhereInput {
  return { ...where, isPublished: true };
}

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
 * A shared course made for a guest's goal is published before its details, which wait for a learner
 * with an account, so listing also needs the details.
 */
export function getListedCourseWhere(where: Prisma.CourseWhereInput = {}): Prisma.CourseWhereInput {
  return getPublishedCourseWhere({
    ...where,
    description: { not: null },
    organization: { kind: "brand" },
    visibility: "public",
  });
}

export function isListedCourse(
  course: Pick<Course, "description" | "isPublished" | "visibility">,
): boolean {
  return course.isPublished && course.visibility === "public" && course.description !== null;
}
