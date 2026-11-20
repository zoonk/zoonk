import "server-only";
import { getListedCourseWhere, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getCourseCacheTag } from "../cache/tags";

export async function findPublishedCourseEditions(familyId: string) {
  const editions = await prisma.course.findMany({
    orderBy: { language: "asc" },
    select: {
      id: true,
      language: true,
      organization: { select: { slug: true } },
      slug: true,
      title: true,
    },
    where: getListedCourseWhere({ familyId }),
  });

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

  const [members, editions] = await Promise.all([
    prisma.course.findMany({ select: { id: true }, where: { familyId: course.familyId } }),
    findPublishedCourseEditions(course.familyId),
  ]);

  // The write that lists an edition expires only that course's tag, so unlisted members are tagged too.
  cacheTag(...members.map((member) => getCourseCacheTag(member.id)));

  return editions;
}

/** Includes the requested course; each language edition has its own slug. */
export async function listPublishedCourseEditions({ courseId }: { courseId: string }) {
  if (!isUuid(courseId)) {
    return [];
  }

  return getCachedCourseEditions(courseId);
}
