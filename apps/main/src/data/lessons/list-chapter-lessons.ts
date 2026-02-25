import "server-only";
import { type Lesson, prisma } from "@zoonk/db";
import { cache } from "react";

const cachedListChapterLessons = cache(
  async (chapterId: number): Promise<Lesson[]> =>
    prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId, isPublished: true },
    }),
);

export function listChapterLessons(params: { chapterId: number }): Promise<Lesson[]> {
  return cachedListChapterLessons(params.chapterId);
}
