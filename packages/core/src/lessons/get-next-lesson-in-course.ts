import "server-only";
import { type LessonKind, getPublishedLessonWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type NextLessonInCourse = {
  lessonId: string;
  lessonKind: LessonKind;
  lessonPosition: number;
  lessonTitle: string | null;
  chapterId: string;
  chapterSlug: string;
  lessonDescription: string;
  lessonSlug: string;
};

const cachedGetNextLesson = cache(
  async (
    chapterId: string,
    chapterPosition: number,
    courseId: string,
    lessonId: string,
    lessonPosition: number,
  ): Promise<NextLessonInCourse | null> => {
    const { data: lesson, error } = await safeAsync(() =>
      prisma.lesson.findFirst({
        include: { chapter: true },
        orderBy: [{ chapter: { position: "asc" } }, { position: "asc" }],
        where: {
          AND: [
            getPublishedLessonWhere({
              courseWhere: { id: courseId },
              lessonWhere: { generationStatus: "completed" },
            }),
            {
              OR: [
                {
                  chapter: {
                    id: chapterId,
                    position: chapterPosition,
                  },
                  id: { not: lessonId },
                  position: { gt: lessonPosition },
                },
                {
                  chapter: { position: { gt: chapterPosition } },
                },
              ],
            },
          ],
        },
      }),
    );

    if (error || !lesson) {
      return null;
    }

    return {
      chapterId: lesson.chapter.id,
      chapterSlug: lesson.chapter.slug,
      lessonDescription: lesson.description,
      lessonId: lesson.id,
      lessonKind: lesson.kind,
      lessonPosition: lesson.position,
      lessonSlug: lesson.slug,
      lessonTitle: lesson.title,
    };
  },
);

/**
 * Finds the next published, generated lesson in course order using structural position.
 */
export function getNextLessonInCourse(params: {
  chapterId: string;
  chapterPosition: number;
  courseId: string;
  lessonId: string;
  lessonPosition: number;
}): Promise<NextLessonInCourse | null> {
  return cachedGetNextLesson(
    params.chapterId,
    params.chapterPosition,
    params.courseId,
    params.lessonId,
    params.lessonPosition,
  );
}
