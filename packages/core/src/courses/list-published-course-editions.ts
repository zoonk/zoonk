import "server-only";
import { getPublishedCourseWhere, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getCourseCacheTag } from "../cache/tags";

async function getCachedCourseEditions(courseId: string) {
  "use cache";
  cacheTag(getCourseCacheTag(courseId));

  const course = await prisma.course.findUnique({
    select: { familyId: true },
    where: { id: courseId },
  });

  if (!course?.familyId) {
    return [];
  }

  const editions = await prisma.course.findMany({
    orderBy: { language: "asc" },
    select: { id: true, language: true, organization: { select: { slug: true } }, slug: true },
    where: getPublishedCourseWhere({
      familyId: course.familyId,
      organization: { kind: "brand" },
      visibility: "public",
    }),
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
          },
        ]
      : [],
  );
}

/**
 * Lists the published editions of a course in every language, itself
 * included. Editions have their own slugs, so public pages link them as
 * language alternates (hreflang) instead of translating one URL.
 */
export async function listPublishedCourseEditions({ courseId }: { courseId: string }) {
  if (!isUuid(courseId)) {
    return [];
  }

  return getCachedCourseEditions(courseId);
}
