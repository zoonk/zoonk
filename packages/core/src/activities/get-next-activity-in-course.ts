import "server-only";
import { type ActivityKind, getPublishedActivityWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type NextActivityInCourse = {
  activityId: string;
  activityKind: ActivityKind;
  activityPosition: number;
  activityTitle: string | null;
  chapterId: string;
  chapterSlug: string;
  lessonDescription: string;
  lessonId: string;
  lessonSlug: string;
  lessonTitle: string;
};

const cachedGetNextActivity = cache(
  async (
    activityPosition: number,
    chapterId: string,
    chapterPosition: number,
    courseId: string,
    lessonId: string,
    lessonPosition: number,
  ): Promise<NextActivityInCourse | null> => {
    const { data: activity, error } = await safeAsync(() =>
      prisma.activity.findFirst({
        include: {
          lesson: {
            include: { chapter: true },
          },
        },
        orderBy: [
          { lesson: { chapter: { position: "asc" } } },
          { lesson: { position: "asc" } },
          { position: "asc" },
        ],
        where: getPublishedActivityWhere({
          activityWhere: {
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
          },
          courseWhere: { id: courseId },
        }),
      }),
    );

    if (error || !activity) {
      return null;
    }

    return {
      activityId: activity.id,
      activityKind: activity.kind,
      activityPosition: activity.position,
      activityTitle: activity.title,
      chapterId: activity.lesson.chapter.id,
      chapterSlug: activity.lesson.chapter.slug,
      lessonDescription: activity.lesson.description,
      lessonId: activity.lesson.id,
      lessonSlug: activity.lesson.slug,
      lessonTitle: activity.lesson.title,
    };
  },
);

/**
 * Finds the next published, generated activity in course order
 * using structural position (not user progress).
 */
export function getNextActivityInCourse(params: {
  activityPosition: number;
  chapterId: string;
  chapterPosition: number;
  courseId: string;
  lessonId: string;
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
