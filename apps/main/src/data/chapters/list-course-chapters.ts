import "server-only";
import { type GenerationStatus, prisma } from "@zoonk/db";
import { cache } from "react";

export type ChapterForList = {
  id: number;
  slug: string;
  title: string;
  description: string;
  position: number;
  generationStatus: GenerationStatus;
};

const cachedListCourseChapters = cache(
  async (courseId: number): Promise<ChapterForList[]> =>
    prisma.chapter.findMany({
      orderBy: { position: "asc" },
      select: {
        description: true,
        generationStatus: true,
        id: true,
        position: true,
        slug: true,
        title: true,
      },
      where: { courseId, isPublished: true },
    }),
);

export function listCourseChapters(params: { courseId: number }): Promise<ChapterForList[]> {
  return cachedListCourseChapters(params.courseId);
}
