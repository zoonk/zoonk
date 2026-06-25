import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const getPeriodContentCreated = cacheAdminData(async (start: Date, end: Date) => {
  const [courses, chapters, lessons] = await Promise.all([
    prisma.course.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.chapter.count({
      where: { createdAt: { gte: start, lte: end }, generationStatus: "completed" },
    }),
    prisma.lesson.count({
      where: {
        chapter: { generationStatus: "completed" },
        createdAt: { gte: start, lte: end },
        generationStatus: "completed",
      },
    }),
  ]);

  return { chapters, courses, lessons };
});
