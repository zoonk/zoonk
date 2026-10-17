import "server-only";
import { getCourseRouteWhere, prisma } from "@zoonk/db";
import { cacheLife, cacheTag } from "next/cache";
import { getCourseCacheTag, getCourseRouteCacheTag } from "../cache/tags";
import { decodeRouteParam } from "../navigation/decode-route-param";

/**
 * Caches one normalized public course route for the catalog's lifetime and tags the route and the
 * course it resolves to: publishing, renaming or unpublishing expires the route's tags, so a cached
 * "not found" never hides a newly published course, and a course's edits expire its own tag. A
 * write whose tags don't reach this app shows within the catalog's lifetime. Only shared courses:
 * the pages that read it are the same for everyone and never read a session.
 */
async function getCachedCourse(params: { brandSlug: string; courseSlug: string }) {
  "use cache";
  cacheLife("catalog");
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
