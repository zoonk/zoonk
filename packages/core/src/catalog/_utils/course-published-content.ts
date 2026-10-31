import "server-only";
import { prisma } from "@zoonk/db";
import { type CourseOutlineChapter } from "../../goals/_utils/course-plan-graph";

export async function loadCoursePublishedContent(chapters: readonly CourseOutlineChapter[]) {
  const ids = [...new Set(chapters.flatMap((chapter) => chapter.lessonIds))];

  const lessons = await prisma.lesson.findMany({
    select: { estimatedMinutes: true, id: true },
    where: { id: { in: ids }, visibility: "public" },
  });

  return {
    lessons: lessons.length,
    minutes: lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0),
  };
}
