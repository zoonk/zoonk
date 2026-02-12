import "server-only";
import { type GenerationStatus, prisma } from "@zoonk/db";
import { cache } from "react";

export type LessonForList = {
  id: number;
  slug: string;
  title: string;
  description: string;
  position: number;
  generationStatus: GenerationStatus;
};

const cachedListChapterLessons = cache(
  async (chapterId: number): Promise<LessonForList[]> =>
    prisma.lesson.findMany({
      orderBy: { position: "asc" },
      select: {
        description: true,
        generationStatus: true,
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
