import "server-only";
import { getCourseRouteWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCourseCacheTag, getCourseRouteCacheTag } from "../cache/tags";
import { decodeRouteParam } from "../navigation/decode-route-param";

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

/** Accepts encoded route slugs and normalizes them before caching. */
export async function getCourse(params: { brandSlug: string; courseSlug: string }) {
  return getCachedCourse({
    brandSlug: decodeRouteParam(params.brandSlug),
    courseSlug: decodeRouteParam(params.courseSlug),
  });
}

export type CourseWithDetails = NonNullable<Awaited<ReturnType<typeof getCourse>>>;
