import "server-only";
import { type Lesson, getPublishedLessonWhere, prisma } from "@zoonk/db";
import { cache } from "react";

const cachedListChapterLessons = cache(
  async (chapterId: number): Promise<Lesson[]> =>
    prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: getPublishedLessonWhere({
        lessonWhere: { chapterId },
      }),
    }),
);

export function listChapterLessons(params: { chapterId: number }): Promise<Lesson[]> {
  return cachedListChapterLessons(params.chapterId);
}
