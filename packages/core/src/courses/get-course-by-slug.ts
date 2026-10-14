import "server-only";
import { getCourseRouteWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCourseCacheTag, getCourseRouteCacheTag } from "../cache/tags";
import { decodeRouteParam } from "../navigation/decode-route-param";

/**
 * Caches one normalized public course route and tags the resolved resource so
 * route misses and course updates can both be invalidated precisely.
 */
async function getCachedCourse(params: {
  brandSlug: string;
  courseSlug: string;
  version: string | null;
}) {
  "use cache";
  cacheTag(getCourseRouteCacheTag(params));

  const course = await prisma.course.findFirst({
    include: { categories: true, organization: true },
    where: getCourseRouteWhere(params),
  });

  if (course) {
    cacheTag(getCourseCacheTag(course.id));
  }

  return course;
}

/**
 * Includes the fresh version check in runtime prefetches and same-request reuse. Keeping it
 * private makes each new request check writes from apps whose tag expiry cannot reach this cache.
 */
async function getCurrentCourse(params: { brandSlug: string; courseSlug: string }) {
  "use cache: private";

  const current = await prisma.course.findFirst({
    select: { id: true, updatedAt: true },
    where: getCourseRouteWhere(params),
  });

  return getCachedCourse({
    ...params,
    version: current ? `${current.id}:${current.updatedAt.getTime()}` : null,
  });
}

/**
 * Loads the public course identified by the brand and course slugs used in catalog routes.
 * Normalizing before both cache boundaries lets encoded and decoded routes share their entries.
 */
export async function getCourse(params: { brandSlug: string; courseSlug: string }) {
  return getCurrentCourse({
    brandSlug: decodeRouteParam(params.brandSlug),
    courseSlug: decodeRouteParam(params.courseSlug),
  });
}

export type CourseWithDetails = NonNullable<Awaited<ReturnType<typeof getCourse>>>;
