import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export type LessonForList = {
  id: number;
  slug: string;
  title: string;
  description: string;
  position: number;
};

const cachedListChapterLessons = cache(
  async (chapterId: number): Promise<LessonForList[]> =>
    prisma.lesson.findMany({
      orderBy: { position: "asc" },
      select: {
        description: true,
        id: true,
        position: true,
        slug: true,
        title: true,
      },
      where: { chapterId, isPublished: true },
    }),
);

export function listChapterLessons(params: { chapterId: number }): Promise<LessonForList[]> {
  return cachedListChapterLessons(params.chapterId);
}
