import "server-only";
import { type Chapter, prisma } from "@zoonk/db";
import { cache } from "react";

const cachedListCourseChapters = cache(
  async (courseId: number): Promise<Chapter[]> =>
    prisma.chapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId, isPublished: true },
    }),
);

export function listCourseChapters(params: { courseId: number }): Promise<Chapter[]> {
  return cachedListCourseChapters(params.courseId);
}
