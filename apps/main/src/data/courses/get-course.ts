import "server-only";
import { getCourseCacheTag, getCourseRouteCacheTag } from "@/data/cache-tags";
import { getPublishedCourseWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { decodeRouteParam } from "../_utils/route-params";

/**
 * Caches published course shells briefly because catalog metadata and pages read
 * the same public record, while generation can still update it frequently.
 */
export async function getCourse(params: { brandSlug: string; courseSlug: string }) {
  "use cache";

  const brandSlug = decodeRouteParam(params.brandSlug);
  const courseSlug = decodeRouteParam(params.courseSlug);
  cacheTag(getCourseRouteCacheTag({ brandSlug, courseSlug }));

  const course = await prisma.course.findFirst({
    include: { categories: true, organization: true },
    where: getPublishedCourseWhere({
      isPublished: true,
      organization: { kind: "brand", slug: brandSlug },
      slug: courseSlug,
    }),
  });

  if (course) {
    cacheTag(getCourseCacheTag(course.id));
  }

  return course;
}

export type CourseWithDetails = NonNullable<Awaited<ReturnType<typeof getCourse>>>;
