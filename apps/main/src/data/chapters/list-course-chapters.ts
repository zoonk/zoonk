import "server-only";
import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { cache } from "react";

const cachedListCourseChapters = cache(async (courseId: string) =>
  prisma.chapter.findMany({
    include: { _count: { select: { lessons: { where: { isPublished: true } } } } },
    orderBy: { position: "asc" },
    where: getPublishedChapterWhere({ chapterWhere: { courseId } }),
  }),
);

export function listCourseChapters(params: { courseId: string }) {
  return cachedListCourseChapters(params.courseId);
}

export type CourseChapter = Awaited<ReturnType<typeof listCourseChapters>>[number];
