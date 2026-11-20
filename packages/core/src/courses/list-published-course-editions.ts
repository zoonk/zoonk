import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getCourseCacheTag } from "../cache/tags";

export async function findPublishedCourseEditions(familyId: string) {
  return prisma.course.findMany({
    orderBy: { language: "asc" },
    select: {
      country: true,
      format: true,
      id: true,
      language: true,
      organization: { select: { slug: true } },
      slug: true,
      targetLanguage: true,
      title: true,
    },
    where: { familyId, isPublished: true, userId: null, visibility: "public" },
  });
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

  return editions.map(({ organization, id, language, slug, title }) => ({
    brandSlug: organization?.slug ?? null,
    courseSlug: slug,
    id,
    language,
    title,
  }));
}

/** Includes the requested course; each language edition has its own slug. */
export async function listPublishedCourseEditions({ courseId }: { courseId: string }) {
  if (!isUuid(courseId)) {
    return [];
  }

  return getCachedCourseEditions(courseId);
}

export async function listCourseEditionLinks(courseId: string) {
  const editions = await listPublishedCourseEditions({ courseId });

  return editions.flatMap((edition) =>
    edition.brandSlug ? [{ ...edition, brandSlug: edition.brandSlug }] : [],
  );
}
