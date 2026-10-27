import "server-only";
import { getCourseRouteWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCourseCacheTag, getCourseRouteCacheTag } from "../cache/tags";
import { decodeRouteParam } from "../navigation/decode-route-param";

/**
 * Caches one normalized public course route and tags the route and the course it resolves to:
 * publishing, renaming or unpublishing expires the route's tags, so a cached "not found" never
 * hides a newly published course, and a course's edits expire its own tag. A write in another app
 * shows once the default cache lifetime revalidates it. Only shared courses: the pages that read it
 * are the same for everyone and never read a session.
 */
async function getCachedCourse(params: { brandSlug: string; courseSlug: string }) {
  "use cache";
  cacheTag(getCourseRouteCacheTag(params));

  const course = await prisma.course.findFirst({
    include: { categories: true, organization: true },
    where: { ...getCourseRouteWhere(params), visibility: "public" },
  });

  if (course) {
    cacheTag(getCourseCacheTag(course.id));
  }

  return course;
}

/**
 * Loads the public course identified by the brand and course slugs used in catalog routes.
 * Normalizing before the cache boundary lets encoded and decoded routes share their entry.
 */
export async function getCourse(params: { brandSlug: string; courseSlug: string }) {
  return getCachedCourse({
    brandSlug: decodeRouteParam(params.brandSlug),
    courseSlug: decodeRouteParam(params.courseSlug),
  });
}

export type CourseWithDetails = NonNullable<Awaited<ReturnType<typeof getCourse>>>;
