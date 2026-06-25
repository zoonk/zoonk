import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const countContent = cacheAdminData(async () => {
  const [courses, chapters, lessons, steps, completedLessonsByKind] = await Promise.all([
    prisma.course.count(),
    prisma.chapter.count({ where: { generationStatus: "completed" } }),
    prisma.lesson.count({
      where: { chapter: { generationStatus: "completed" }, generationStatus: "completed" },
    }),
    prisma.step.count(),
    prisma.lesson.groupBy({
      _count: { kind: true },
      by: ["kind"],
      orderBy: { kind: "asc" },
      where: { chapter: { generationStatus: "completed" }, generationStatus: "completed" },
    }),
  ]);

  return {
    chapters,
    completedLessonsByKind: completedLessonsByKind.map((row) => ({
      count: row._count.kind,
      kind: row.kind,
    })),
    courses,
    lessons,
    steps,
  };
});
