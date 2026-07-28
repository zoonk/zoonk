import "server-only";
import { getPublishedCourseWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCourseCacheTag, getCourseRouteCacheTag } from "../cache/tags";
import { decodeRouteParam } from "../navigation/decode-route-param";

/**
 * Caches one normalized public course route and tags the resolved resource so
 * route misses and course updates can both be invalidated precisely.
 */
async function getCachedCourse(params: { brandSlug: string; courseSlug: string }) {
  "use cache";
  cacheTag(getCourseRouteCacheTag(params));

  const course = await prisma.course.findFirst({
    include: { categories: true, organization: true },
    where: getPublishedCourseWhere({
      organization: { kind: "brand", slug: params.brandSlug },
      slug: params.courseSlug,
    }),
  });

  if (course) {
    cacheTag(getCourseCacheTag(course.id));
  }

  return course;
}

/**
 * Loads the public course identified by the brand and course slugs used in
 * catalog routes. Normalizing before the cached boundary makes encoded and
 * decoded versions of the same route share one cache entry.
 */
export async function getCourse(params: { brandSlug: string; courseSlug: string }) {
  return getCachedCourse({
    brandSlug: decodeRouteParam(params.brandSlug),
    courseSlug: decodeRouteParam(params.courseSlug),
  });
}

export type CourseWithDetails = NonNullable<Awaited<ReturnType<typeof getCourse>>>;
