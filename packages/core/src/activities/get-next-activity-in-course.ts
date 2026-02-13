import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type NextActivityInCourse = {
  activityPosition: number;
  chapterSlug: string;
  lessonSlug: string;
};

const cachedGetNextActivity = cache(
  async (
    activityPosition: number,
    chapterId: number,
    chapterPosition: number,
    courseId: number,
    lessonId: number,
    lessonPosition: number,
  ): Promise<NextActivityInCourse | null> => {
    const { data: activity, error } = await safeAsync(() =>
      prisma.activity.findFirst({
        orderBy: [
          { lesson: { chapter: { position: "asc" } } },
          { lesson: { position: "asc" } },
          { position: "asc" },
        ],
        select: {
          lesson: {
            select: {
              chapter: { select: { slug: true } },
              slug: true,
            },
          },
          position: true,
        },
        where: {
          OR: [
            {
              lesson: {
                chapter: { position: chapterPosition },
                id: lessonId,
              },
              position: { gt: activityPosition },
            },
            {
              lesson: {
                chapter: { id: chapterId, position: chapterPosition },
                position: { gt: lessonPosition },
              },
            },
            {
              lesson: {
                chapter: { position: { gt: chapterPosition } },
              },
            },
          ],
          generationStatus: "completed",
          isPublished: true,
          lesson: {
            chapter: {
              course: { id: courseId },
              isPublished: true,
            },
            isPublished: true,
          },
        },
      }),
    );

    if (error || !activity) {
      return null;
    }

    return {
      activityPosition: activity.position,
      chapterSlug: activity.lesson.chapter.slug,
      lessonSlug: activity.lesson.slug,
    };
  },
);

/**
 * Finds the next published, generated activity in course order
 * using structural position (not user progress).
 */
export function getNextActivityInCourse(params: {
  activityPosition: number;
  chapterId: number;
  chapterPosition: number;
  courseId: number;
  lessonId: number;
  lessonPosition: number;
}): Promise<NextActivityInCourse | null> {
  return cachedGetNextActivity(
    params.activityPosition,
    params.chapterId,
    params.chapterPosition,
    params.courseId,
    params.lessonId,
    params.lessonPosition,
  );
}
