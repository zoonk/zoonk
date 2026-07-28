import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";

/**
 * Finds the first published introduction lesson with the stable identifiers
 * needed by native and API clients.
 */
export async function getFirstCourseLessonResource({ courseId }: { courseId: string }) {
  if (!isUuid(courseId)) {
    return null;
  }

  const introChapter = await prisma.chapter.findFirst({
    include: {
      lessons: {
        select: { id: true, slug: true },
        take: 1,
        where: { isPublished: true, position: 0 },
      },
    },
    where: { courseId, isPublished: true, position: 0 },
  });

  const firstLesson = introChapter?.lessons[0];

  if (!introChapter || !firstLesson) {
    return null;
  }

  return {
    chapterId: introChapter.id,
    chapterSlug: introChapter.slug,
    lessonId: firstLesson.id,
    lessonSlug: firstLesson.slug,
  };
}

/**
 * Preserves Main's slug-based route target while the shared resource query also
 * serves ID-based delivery clients.
 */
export async function getFirstCourseLesson({
  courseId,
}: {
  courseId: string;
}): Promise<{ chapterSlug: string; lessonSlug: string } | null> {
  const lesson = await getFirstCourseLessonResource({ courseId });

  return lesson ? { chapterSlug: lesson.chapterSlug, lessonSlug: lesson.lessonSlug } : null;
}
