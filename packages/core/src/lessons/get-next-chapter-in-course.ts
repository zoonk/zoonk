import "server-only";
import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type NextChapterInCourse = {
  brandSlug: string;
  chapterId: string;
  chapterSlug: string;
  chapterTitle: string;
  courseSlug: string;
};

const cachedGetNextChapter = cache(
  async (chapterPosition: number, courseId: string): Promise<NextChapterInCourse | null> => {
    const { data: chapter, error } = await safeAsync(() =>
      prisma.chapter.findFirst({
        include: { course: { include: { organization: true } } },
        orderBy: { position: "asc" },
        where: getPublishedChapterWhere({
          chapterWhere: { courseId, position: { gt: chapterPosition } },
        }),
      }),
    );

    if (error || !chapter) {
      return null;
    }

    return {
      brandSlug: chapter.course.organization?.slug ?? "",
      chapterId: chapter.id,
      chapterSlug: chapter.slug,
      chapterTitle: chapter.title,
      courseSlug: chapter.course.slug,
    };
  },
);

/**
 * Finds the next published chapter in course order using structural position.
 */
export function getNextChapterInCourse(params: {
  chapterPosition: number;
  courseId: string;
}): Promise<NextChapterInCourse | null> {
  return cachedGetNextChapter(params.chapterPosition, params.courseId);
}
