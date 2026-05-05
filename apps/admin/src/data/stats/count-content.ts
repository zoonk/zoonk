import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const countContent = cache(async () => {
  const [courses, chapters, lessons, steps] = await Promise.all([
    prisma.course.count(),
    prisma.chapter.count(),
    prisma.lesson.count(),
    prisma.step.count(),
  ]);

  return { chapters, courses, lessons, steps };
});
