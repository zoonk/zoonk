import "server-only";
import { type Chapter, getPublishedChapterWhere, prisma } from "@zoonk/db";
import { cache } from "react";

const cachedListCourseChapters = cache(
  async (courseId: string): Promise<Chapter[]> =>
    prisma.chapter.findMany({
      orderBy: { position: "asc" },
      where: getPublishedChapterWhere({
        chapterWhere: { courseId },
      }),
    }),
);

export function listCourseChapters(params: { courseId: string }): Promise<Chapter[]> {
  return cachedListCourseChapters(params.courseId);
}
