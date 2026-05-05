import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const getPeriodContentCreated = cache(async (start: Date, end: Date) => {
  const [courses, lessons] = await Promise.all([
    prisma.course.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.lesson.count({ where: { createdAt: { gte: start, lte: end } } }),
  ]);

  return { courses, lessons };
});
