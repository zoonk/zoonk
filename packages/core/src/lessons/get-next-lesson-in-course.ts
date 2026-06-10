import "server-only";
import { type GenerationStatus, type LessonKind, getPublishedLessonWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import {
  type LessonKindExclusion,
  getLessonKindExclusionCacheArgs,
  getLessonKindExclusionWhere,
} from "./lesson-kind-exclusions";

export type NextLessonInCourse = {
  lessonId: string;
  lessonKind: LessonKind;
  lessonPosition: number;
  lessonTitle: string | null;
  chapterId: string;
  chapterPosition: number;
  chapterSlug: string;
  chapterTitle: string;
  lessonDescription: string | null;
  lessonGenerationStatus: GenerationStatus;
  lessonSlug: string;
};

const cachedGetNextLesson = cache(
  async (
    chapterId: string,
    chapterPosition: number,
    courseId: string,
    lessonPosition: number,
    ...excludedLessonKinds: LessonKind[]
  ): Promise<NextLessonInCourse | null> => {
    const { data: lesson, error } = await safeAsync(() =>
      prisma.lesson.findFirst({
        include: { chapter: true },
        orderBy: [{ chapter: { position: "asc" } }, { position: "asc" }],
        where: getPublishedLessonWhere({
          courseWhere: { id: courseId },
          lessonWhere: {
            ...getLessonKindExclusionWhere({ excludedLessonKinds }),
            OR: [
              { chapter: { id: chapterId }, position: { gt: lessonPosition } },
              { chapter: { position: { gt: chapterPosition } } },
            ],
          },
        }),
      }),
    );

    if (error || !lesson) {
      return null;
    }

    return {
      chapterId: lesson.chapter.id,
      chapterPosition: lesson.chapter.position,
      chapterSlug: lesson.chapter.slug,
      chapterTitle: lesson.chapter.title,
      lessonDescription: lesson.description,
      lessonGenerationStatus: lesson.generationStatus,
      lessonId: lesson.id,
      lessonKind: lesson.kind,
      lessonPosition: lesson.position,
      lessonSlug: lesson.slug,
      lessonTitle: lesson.title,
    };
  },
);

/**
 * Finds the next published lesson in course order using structural position.
 */
export function getNextLessonInCourse(params: {
  chapterId: string;
  chapterPosition: number;
  courseId: string;
  excludedLessonKinds?: LessonKindExclusion["excludedLessonKinds"];
  lessonPosition: number;
}): Promise<NextLessonInCourse | null> {
  return cachedGetNextLesson(
    params.chapterId,
    params.chapterPosition,
    params.courseId,
    params.lessonPosition,
    ...getLessonKindExclusionCacheArgs({ excludedLessonKinds: params.excludedLessonKinds }),
  );
}
