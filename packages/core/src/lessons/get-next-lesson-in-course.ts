import "server-only";
import { type GenerationStatus, type LessonKind } from "@zoonk/db";
import { cache } from "react";
import { getNextSibling } from "../player/queries/get-next-sibling";

export type NextLessonInCourse = {
  lessonId: string;
  lessonKind: LessonKind;
  lessonPosition: number;
  lessonTitle: string | null;
  chapterId: string;
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
  ): Promise<NextLessonInCourse | null> => {
    const lesson = await getNextSibling({
      chapterId,
      chapterPosition,
      courseId,
      lessonPosition,
      level: "lesson",
    });

    if (!lesson) {
      return null;
    }

    return {
      chapterId: lesson.chapterId,
      chapterSlug: lesson.chapterSlug,
      chapterTitle: lesson.chapterTitle,
      lessonDescription: lesson.lessonDescription,
      lessonGenerationStatus: lesson.lessonGenerationStatus,
      lessonId: lesson.lessonId,
      lessonKind: lesson.lessonKind,
      lessonPosition: lesson.lessonPosition,
      lessonSlug: lesson.lessonSlug,
      lessonTitle: lesson.lessonTitle,
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
  lessonId: string;
  lessonPosition: number;
}): Promise<NextLessonInCourse | null> {
  return cachedGetNextLesson(
    params.chapterId,
    params.chapterPosition,
    params.courseId,
    params.lessonPosition,
  );
}
