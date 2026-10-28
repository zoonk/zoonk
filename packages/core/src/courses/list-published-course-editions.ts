import "server-only";
import { getListedCourseWhere, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { COURSE_LIST_CACHE_TAG, getCourseCacheTag } from "../cache/tags";

async function getCachedCourseEditions(courseId: string) {
  "use cache";
  cacheTag(getCourseCacheTag(courseId), COURSE_LIST_CACHE_TAG);

  const course = await prisma.course.findUnique({
    select: { familyId: true },
    where: { id: courseId },
  });

  if (!course?.familyId) {
    return [];
  }

  const editions = await prisma.course.findMany({
    orderBy: { language: "asc" },
    select: {
      id: true,
      language: true,
      organization: { select: { slug: true } },
      slug: true,
      title: true,
    },
    where: getListedCourseWhere({ familyId: course.familyId }),
  });

  cacheTag(...editions.map((edition) => getCourseCacheTag(edition.id)));

  return editions.flatMap((edition) =>
    edition.organization
      ? [
          {
            brandSlug: edition.organization.slug,
            courseSlug: edition.slug,
            id: edition.id,
            language: edition.language,
            title: edition.title,
          },
        ]
      : [],
  );
}

/** Includes the requested course; each language edition has its own slug. */
export async function listPublishedCourseEditions({ courseId }: { courseId: string }) {
  if (!isUuid(courseId)) {
    return [];
  }

  return getCachedCourseEditions(courseId);
}
