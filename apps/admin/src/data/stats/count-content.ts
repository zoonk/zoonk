import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const countContent = cache(async () => {
  const [courses, chapters, lessons, steps, completedLessonsByKind] = await Promise.all([
    prisma.course.count(),
    prisma.chapter.count(),
    prisma.lesson.count(),
    prisma.step.count(),
    prisma.lesson.groupBy({
      _count: { kind: true },
      by: ["kind"],
      orderBy: { kind: "asc" },
      where: { generationStatus: "completed" },
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
