import "server-only";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";

export type FirstCourseLessonHref = `/b/${typeof AI_ORG_SLUG}/c/${string}/ch/${string}/l/${string}`;

/**
 * Finds the generated intro lesson route for regular courses. The generate page
 * uses this to leave the waiting UI as soon as the first lesson exists, even
 * when the broader course workflow is still filling in later content.
 */
export async function getFirstCourseLessonHref({
  courseId,
  courseSlug,
}: {
  courseId: string;
  courseSlug: string;
}): Promise<FirstCourseLessonHref | null> {
  const introChapter = await prisma.chapter.findFirst({
    include: { lessons: { take: 1, where: { isPublished: true, position: 0 } } },
    where: { courseId, isPublished: true, position: 0 },
  });

  const firstLesson = introChapter?.lessons[0];

  if (!introChapter || !firstLesson) {
    return null;
  }

  return `/b/${AI_ORG_SLUG}/c/${courseSlug}/ch/${introChapter.slug}/l/${firstLesson.slug}` as const;
}
